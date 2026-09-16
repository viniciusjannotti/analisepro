// ─── BCB Collector (Banco Central do Brasil) ────────────────────────────────
// Fetches official SELIC, IPCA, and PTAX (USD/BRL) from the Central Bank APIs.
// No API key required. No documented rate limits.

import type { CollectorResult, BcbData, BcbSeriesPoint, BcbPtaxQuote } from './types'

const SGS_BASE = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs'
const PTAX_BASE = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata'
const TIMEOUT_MS = 10_000

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`BCB ${res.status}: ${res.statusText}`)
  return res.json() as Promise<T>
}

/** Fetch the latest value of a BCB SGS series */
async function fetchSGSSeries(seriesCode: number): Promise<BcbSeriesPoint | null> {
  const data = await fetchJSON<BcbSeriesPoint[]>(
    `${SGS_BASE}.${seriesCode}/dados/ultimos/1?formato=json`
  )
  return data?.[0] ?? null
}

/** Fetch today's (or latest available) PTAX quote */
async function fetchPTAX(): Promise<BcbPtaxQuote | null> {
  // Try today first, then go back up to 5 business days
  for (let daysBack = 0; daysBack <= 5; daysBack++) {
    const d = new Date()
    d.setDate(d.getDate() - daysBack)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const yyyy = d.getFullYear()
    const dateStr = `'${mm}-${dd}-${yyyy}'`

    try {
      const result = await fetchJSON<{ value: BcbPtaxQuote[] }>(
        `${PTAX_BASE}/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao=${dateStr}&$format=json`
      )
      if (result.value && result.value.length > 0) {
        return result.value[result.value.length - 1] // Last quote of the day
      }
    } catch {
      // Try previous day
    }
  }
  return null
}

export async function collect(): Promise<CollectorResult<BcbData>> {
  const now = new Date().toISOString()

  try {
    const [selicRes, ipcaRes, ptaxRes] = await Promise.allSettled([
      fetchSGSSeries(11),   // SELIC target rate
      fetchSGSSeries(433),  // IPCA monthly
      fetchPTAX(),
    ])

    const selic = selicRes.status === 'fulfilled' ? selicRes.value : null
    const ipca = ipcaRes.status === 'fulfilled' ? ipcaRes.value : null
    const ptax = ptaxRes.status === 'fulfilled' ? ptaxRes.value : null

    if (!selic && !ipca && !ptax) {
      throw new Error('All BCB sub-calls returned null')
    }

    return {
      source: 'BCB',
      success: true,
      data: { selic, ipca, ptax },
      collectedAt: now,
    }
  } catch (err) {
    return {
      source: 'BCB',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      collectedAt: now,
    }
  }
}
