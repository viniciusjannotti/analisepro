import { NextRequest } from 'next/server'
import { YahooProvider } from '@/lib/lmp/providers/yahoo'
import { executarPipeline } from '@/lib/lmp/pipeline'
import { B3_UNIVERSE_INICIAL } from '@/lib/lmp/universe-b3'
import { gravarExecucao } from '@/lib/screener-store'
import { gerarNarrativas } from '@/lib/screener-narrative'
import { enviarEmailCandidatos, enviarPushCandidatos } from '@/lib/notifications/screener'
import { adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { ResultadoPipeline } from '@/lib/lmp/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 300

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token === process.env.CRON_SECRET && !!token
}

function dataDeReferencia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

async function notificarSeNecessario(asOfDate: string, resultado: ResultadoPipeline) {
  const { status, candidatasFinais, falhas } = resultado.execucao
  if (candidatasFinais === 0 || (status !== 'ok' && status !== 'parcial')) return

  const runRef = adminDb.collection('screenerRuns').doc(asOfDate)
  const existente = await runRef.get()
  if (existente.data()?.notificadoEm) return

  const config = (await adminDb.collection('config').doc('notifications').get()).data() ?? {}
  if (config.emailEnabled && config.emailTo?.length) {
    await enviarEmailCandidatos({
      to: config.emailTo,
      asOfDate,
      candidatos: resultado.candidatos,
      status,
      falhas: falhas.length,
    })
  }
  if (config.pushEnabled) {
    await enviarPushCandidatos({ asOfDate, quantidade: candidatasFinais })
  }
  await runRef.set({ notificadoEm: FieldValue.serverTimestamp() }, { merge: true })
}

async function executar(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const asOfDate = dataDeReferencia()
  const porNarrativa = await executarPipeline({
    universo: B3_UNIVERSE_INICIAL,
    provider: new YahooProvider(),
    asOfDate,
  })
  const narrativas = await gerarNarrativas(porNarrativa.candidatos)
  const resultado: ResultadoPipeline = {
    ...porNarrativa,
    candidatos: porNarrativa.candidatos.map((c) => ({ ...c, narrativa: narrativas.get(c.ticker) ?? null })),
  }
  await gravarExecucao(asOfDate, resultado)
  await notificarSeNecessario(asOfDate, resultado)

  const { status, analisadas, aprovadosEtapa1, candidatasFinais, falhas } = resultado.execucao
  return Response.json(
    { asOfDate, status, analisadas, aprovadosEtapa1, candidatasFinais, falhas: falhas.length },
    { status: status === 'erro' ? 500 : 200 }
  )
}

export async function GET(req: NextRequest) {
  return executar(req)
}

export async function POST(req: NextRequest) {
  return executar(req)
}
