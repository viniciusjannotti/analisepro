import { NextRequest } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { ReportType, TacticalRow } from '@/lib/types'
import { sendEmailNotification } from '@/lib/notifications/email'
import { sendPushNotifications } from '@/lib/notifications/push'

export const runtime = 'nodejs'
export const maxDuration = 120

// ─── Auth helper ───────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token === process.env.CRON_SECRET && !!token
}

// ─── JSON schema for structured output ─────────────────────────────────────
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    macroSection: { type: 'string' },
    calendarSection: { type: 'string' },
    hedgeSection: { type: 'string' },
    tacticalTable: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          segment: { type: 'string' },
          asset: { type: 'string' },
          market: { type: 'string' },
          bias: { type: 'string' },
          rationale: { type: 'string' },
          riskPoints: { type: 'string' },
        },
        required: ['segment', 'asset', 'market', 'bias', 'rationale', 'riskPoints'],
      },
    },
  },
  required: ['macroSection', 'calendarSection', 'hedgeSection', 'tacticalTable'],
}

// ─── Gemini call with retry ─────────────────────────────────────────────────
async function callGemini(promptText: string, retries = 2) {
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  // Try to find the best available Gemini model
  // Confirmed against this project's live model list on 2026-09-03 — verify again if generation starts failing,
  // model names/aliases change frequently (see AGENTS.md).
  const CANDIDATE_MODELS = [
    'gemini-3.1-pro-preview',
    'gemini-pro-latest',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
  ]

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await genai.models.generateContent({
          model,
          contents: promptText,
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            temperature: 0.7,
          },
        })

        const text = response.text ?? ''
        const sources: string[] = []

        // Extract grounding sources if available
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata
        if (groundingMetadata?.groundingChunks) {
          for (const chunk of groundingMetadata.groundingChunks) {
            if (chunk?.web?.uri) sources.push(chunk.web.uri)
          }
        }

        // Parse JSON response (defensive)
        let parsed: {
          macroSection: string
          calendarSection: string
          hedgeSection: string
          tacticalTable: Omit<TacticalRow, 'rowId'>[]
        }

        try {
          // Strip possible markdown code fences
          const clean = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
          parsed = JSON.parse(clean)
        } catch {
          throw new Error(`JSON parse failed: ${text.slice(0, 200)}`)
        }

        // Validate required fields
        if (!parsed.macroSection || !Array.isArray(parsed.tacticalTable)) {
          throw new Error('Incomplete response structure from AI')
        }

        return { parsed, sources, model }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.warn(`[generate-report] Model ${model} attempt ${attempt + 1} failed:`, lastError.message)
        // Small backoff before retry
        if (attempt < retries) await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  throw lastError ?? new Error('All model attempts exhausted')
}

// ─── Route handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let type: ReportType
  try {
    const body = await req.json()
    type = body.type
    if (!['pre-market', 'midday', 'closing'].includes(type)) {
      return Response.json({ error: 'Invalid type' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  // 1. Fetch prompt template
  const templateDoc = await adminDb.collection('promptTemplates').doc(type).get()
  if (!templateDoc.exists) {
    return Response.json({ error: `Template "${type}" not found in Firestore` }, { status: 404 })
  }
  const { promptText } = templateDoc.data() as { promptText: string }

  // 2. Create a pending report doc to get ID first (for rowId generation)
  const reportRef = adminDb.collection('reports').doc()
  const reportId = reportRef.id

  try {
    // 3. Call Gemini
    const { parsed, sources, model } = await callGemini(promptText)

    // 4. Generate stable rowIds for each tactical row
    const tacticalTable: TacticalRow[] = parsed.tacticalTable.map((row, idx) => ({
      ...row,
      rowId: `${reportId}-${idx}`,
      // Normalize bias field just in case
      bias: row.bias?.includes('Venda') || row.bias?.toLowerCase() === 'sell'
        ? 'Venda'
        : 'Compra',
    }))

    // 5. Save report
    await reportRef.set({
      type,
      generatedAt: FieldValue.serverTimestamp(),
      macroSection: parsed.macroSection,
      calendarSection: parsed.calendarSection,
      hedgeSection: parsed.hedgeSection,
      tacticalTable,
      sources,
      status: 'success',
      modelUsed: model,
    })

    // 6. Dispatch notifications (non-blocking — don't fail the report if these fail)
    try {
      const notifConfig = await adminDb.collection('config').doc('notifications').get()
      const config = notifConfig.data() ?? {}

      if (config.emailEnabled && config.emailTo?.length) {
        await sendEmailNotification({
          to: config.emailTo,
          reportId,
          reportType: type,
          preview: parsed.macroSection.slice(0, 300),
        })
      }

      if (config.pushEnabled) {
        await sendPushNotifications({ reportId, reportType: type })
      }
    } catch (notifErr) {
      console.error('[generate-report] Notification dispatch failed:', notifErr)
    }

    return Response.json({ success: true, reportId, model }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[generate-report] Generation failed:', message)

    // Save error report so the failure is visible in the dashboard
    await reportRef.set({
      type,
      generatedAt: FieldValue.serverTimestamp(),
      macroSection: '',
      calendarSection: '',
      hedgeSection: '',
      tacticalTable: [],
      sources: [],
      status: 'error',
      errorMessage: message,
    })

    return Response.json({ error: message, reportId }, { status: 500 })
  }
}

// Allow GET for manual testing from browser (still requires auth)
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type') as ReportType | null
  if (!type) return Response.json({ error: 'Missing ?type=' }, { status: 400 })

  const fakeReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ type }),
  })
  return POST(fakeReq)
}
