// ─── FRED Collector (Federal Reserve Economic Data) ──────────────────────────
// Fetches key US macroeconomic indicators.
// Requires FRED_API_KEY env var (free, register at stlouisfed.org).
// Rate limit: 120 requests/minute.

import type { CollectorResult, FredData, FredObservation } from './types'

const BASE = 'https://api.stlouisfed.org/fred/series/observations'
const TIMEOUT_MS = 10_000

const SERIES = [
  { id: 'FEDFUNDS', name: 'Fed Funds Rate' },
  { id: 'CPIAUCSL', name: 'CPI (Consumer Price Index)' },
  { id: 'UNRATE', name: 'Unemployment Rate' },
  { id: 'DGS10', name: '10-Year Treasury Yield' },
  { id: 'DGS2', name: '2-Year Treasury Yield' },
  { id: 'T10Y2Y', name: '10Y-2Y Treasury Spread' },
]

async function fetchSeries(
  seriesId: string,
  seriesName: string,
  apiKey: string
): Promise<FredObservation | null> {
  const url = `${BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`)

  const json = (await res.json()) as { observations?: Array<{ date: string; value: string }> }
  const obs = json.observations?.[0]
  if (!obs || obs.value === '.') return null

  return { seriesId, seriesName, date: obs.date, value: obs.value }
}

export async function collect(): Promise<CollectorResult<FredData>> {
  const now = new Date().toISOString()
  const apiKey = process.env.FRED_API_KEY

  if (!apiKey) {
    return {
      source: 'FRED',
      success: false,
      data: null,
      error: 'FRED_API_KEY not configured (optional — register free at stlouisfed.org)',
      collectedAt: now,
    }
  }

  try {
    const results = await Promise.allSettled(
      SERIES.map((s) => fetchSeries(s.id, s.name, apiKey))
    )

    const observations: FredObservation[] = results
      .filter((r): r is PromiseFulfilledResult<FredObservation | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((v): v is FredObservation => v !== null)

    if (observations.length === 0) {
      throw new Error('All FRED series returned empty')
    }

    return {
      source: 'FRED',
      success: true,
      data: { observations },
      collectedAt: now,
    }
  } catch (err) {
    return {
      source: 'FRED',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      collectedAt: now,
    }
  }
}
