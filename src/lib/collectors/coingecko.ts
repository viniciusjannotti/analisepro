// ─── CoinGecko Collector ─────────────────────────────────────────────────────
// Fetches top crypto by market cap + trending coins (altcoins "off-radar").
// No API key required (public keyless tier: ~10-30 calls/min).

import type { CollectorResult, CoinGeckoData, CoinGeckoMarket, CoinGeckoTrending } from './types'

const BASE = 'https://api.coingecko.com/api/v3'
const TIMEOUT_MS = 10_000

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function collect(): Promise<CollectorResult<CoinGeckoData>> {
  const now = new Date().toISOString()

  try {
    const [marketsRes, trendingRes] = await Promise.allSettled([
      fetchJSON<CoinGeckoMarket[]>(
        `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false`
      ),
      fetchJSON<{
        coins: Array<{ item: { id: string; name: string; symbol: string; market_cap_rank: number | null; price_btc: number; score: number } }>
      }>(`${BASE}/search/trending`),
    ])

    const topCoins = marketsRes.status === 'fulfilled' ? marketsRes.value : []

    const trending: CoinGeckoTrending[] =
      trendingRes.status === 'fulfilled'
        ? trendingRes.value.coins.map((c) => ({
            id: c.item.id,
            name: c.item.name,
            symbol: c.item.symbol,
            market_cap_rank: c.item.market_cap_rank,
            price_btc: c.item.price_btc,
            score: c.item.score,
          }))
        : []

    if (topCoins.length === 0 && trending.length === 0) {
      throw new Error('All CoinGecko sub-calls returned empty data')
    }

    return {
      source: 'CoinGecko',
      success: true,
      data: { topCoins, trending },
      collectedAt: now,
    }
  } catch (err) {
    return {
      source: 'CoinGecko',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      collectedAt: now,
    }
  }
}
