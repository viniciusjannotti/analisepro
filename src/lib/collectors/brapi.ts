// ─── brapi.dev Collector ─────────────────────────────────────────────────────
// Fetches B3 stocks and FIIs. Requires BRAPI_TOKEN env var.
//
// The free plan only allows 1 ticker per request (batching triggers a 400
// QUOTES_PER_REQUEST_EXCEEDED error) and enforces a short burst-concurrency
// limit (occasional 429s under parallel load) — confirmed live on 2026-09-16.
// So each ticker is fetched individually, with limited concurrency and a
// retry on 429. Crypto is NOT fetched here: the free plan returns 403
// FEATURE_NOT_AVAILABLE for /v2/crypto (requires the paid Startup plan) —
// CoinGecko already covers crypto data, so this is skipped rather than retried.

import type { CollectorResult, BrapiData, BrapiQuote } from './types'

const BASE = 'https://brapi.dev/api'
const TIMEOUT_MS = 10_000
const CONCURRENCY = 4

// Representative tickers — expand as needed
const STOCK_TICKERS = [
  'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'WEGE3', 'BBAS3',
  'ABEV3', 'B3SA3', 'RENT3', 'MGLU3', 'LREN3', 'SUZB3',
  'JBSS3', 'GGBR4', 'CSNA3', 'RADL3', 'PRIO3', 'HAPV3',
]

const FII_TICKERS = [
  'HGLG11', 'KNRI11', 'MXRF11', 'XPML11', 'VISC11',
  'BTLG11', 'IRDM11', 'RECR11',
]

async function fetchOne(ticker: string, token: string, retry = true): Promise<BrapiQuote | null> {
  const res = await fetch(`${BASE}/quote/${ticker}?token=${token}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (res.status === 429 && retry) {
    await new Promise((r) => setTimeout(r, 500))
    return fetchOne(ticker, token, false)
  }
  if (!res.ok) return null

  const json = (await res.json()) as { results?: BrapiQuote[] }
  return json.results?.[0] ?? null
}

/** Fetch a list of tickers one-by-one (free plan limit), in small concurrent batches. */
async function fetchTickers(tickers: string[], token: string): Promise<BrapiQuote[]> {
  const out: BrapiQuote[] = []
  for (let i = 0; i < tickers.length; i += CONCURRENCY) {
    const batch = tickers.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(batch.map((t) => fetchOne(t, token)))
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) out.push(r.value)
    }
  }
  return out
}

export async function collect(): Promise<CollectorResult<BrapiData>> {
  const now = new Date().toISOString()
  const token = process.env.BRAPI_TOKEN

  if (!token) {
    return { source: 'brapi.dev', success: false, data: null, error: 'BRAPI_TOKEN not configured', collectedAt: now }
  }

  try {
    const [stocks, fiis] = await Promise.all([
      fetchTickers(STOCK_TICKERS, token),
      fetchTickers(FII_TICKERS, token),
    ])

    if (stocks.length === 0 && fiis.length === 0) {
      throw new Error('All brapi requests returned empty data')
    }

    return {
      source: 'brapi.dev',
      success: true,
      data: { stocks, fiis, crypto: [] }, // crypto requires a paid brapi plan — CoinGecko covers it instead
      collectedAt: now,
    }
  } catch (err) {
    return {
      source: 'brapi.dev',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      collectedAt: now,
    }
  }
}
