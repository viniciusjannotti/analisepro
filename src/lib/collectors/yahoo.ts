// ─── Yahoo Finance Collector ─────────────────────────────────────────────────
// Fetches international indices, commodities, and forex pairs via yahoo-finance2.
// No API key required. Unofficial library — may break without notice.

import type { CollectorResult, YahooData, YahooQuote } from './types'

// Symbols grouped by segment
const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq Composite' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: '^BVSP', name: 'Ibovespa' },
  { symbol: '^FTSE', name: 'FTSE 100' },
  { symbol: '^N225', name: 'Nikkei 225' },
]

const COMMODITIES = [
  { symbol: 'GC=F', name: 'Ouro (Gold)' },
  { symbol: 'CL=F', name: 'Petróleo WTI' },
  { symbol: 'SI=F', name: 'Prata (Silver)' },
  { symbol: 'NG=F', name: 'Gás Natural' },
]

const FOREX = [
  { symbol: 'USDBRL=X', name: 'USD/BRL' },
  { symbol: 'EURBRL=X', name: 'EUR/BRL' },
  { symbol: 'EURUSD=X', name: 'EUR/USD' },
  { symbol: 'GBPUSD=X', name: 'GBP/USD' },
  { symbol: 'USDJPY=X', name: 'USD/JPY' },
]

// The SDK's Quote union includes variants without a guaranteed `symbol`/price
// (e.g. ECN quotes) — narrow defensively at runtime instead of trusting a cast.
function hasUsableQuote(
  r: unknown
): r is { symbol: string; regularMarketPrice: number; shortName?: string; longName?: string; regularMarketChangePercent?: number; currency?: string } {
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof (r as Record<string, unknown>).symbol === 'string' &&
    typeof (r as Record<string, unknown>).regularMarketPrice === 'number'
  )
}

async function fetchQuotes(
  symbols: Array<{ symbol: string; name: string }>
): Promise<YahooQuote[]> {
  // Dynamic import to avoid bundling issues in edge environments.
  // v4 replaced the ready-to-use singleton with a class — must instantiate.
  const { default: YahooFinance } = await import('yahoo-finance2')
  const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

  const tickers = symbols.map((s) => s.symbol)
  const nameMap = new Map(symbols.map((s) => [s.symbol, s.name]))

  try {
    const results = await yahooFinance.quote(tickers)
    const list = Array.isArray(results) ? results : [results]
    return list
      .filter(hasUsableQuote)
      .map((r) => ({
        symbol: r.symbol,
        name: nameMap.get(r.symbol) ?? r.shortName ?? r.longName ?? r.symbol,
        price: r.regularMarketPrice,
        changePercent: r.regularMarketChangePercent ?? 0,
        currency: r.currency ?? 'USD',
      }))
  } catch {
    // If batch quote fails, return empty (don't crash entire collector)
    return []
  }
}

export async function collect(): Promise<CollectorResult<YahooData>> {
  const now = new Date().toISOString()

  try {
    const [indicesRes, commoditiesRes, forexRes] = await Promise.allSettled([
      fetchQuotes(INDICES),
      fetchQuotes(COMMODITIES),
      fetchQuotes(FOREX),
    ])

    const indices = indicesRes.status === 'fulfilled' ? indicesRes.value : []
    const commodities = commoditiesRes.status === 'fulfilled' ? commoditiesRes.value : []
    const forex = forexRes.status === 'fulfilled' ? forexRes.value : []

    if (indices.length === 0 && commodities.length === 0 && forex.length === 0) {
      throw new Error('All Yahoo Finance sub-calls returned empty')
    }

    return {
      source: 'Yahoo Finance',
      success: true,
      data: { indices, commodities, forex },
      collectedAt: now,
    }
  } catch (err) {
    return {
      source: 'Yahoo Finance',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      collectedAt: now,
    }
  }
}
