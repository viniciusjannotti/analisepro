// ─── CryptoPanic Collector ───────────────────────────────────────────────────
// Fetches trending/hot crypto news with sentiment signals.
// Requires CRYPTOPANIC_API_KEY env var (free tier available).

import type { CollectorResult, CryptoPanicData, CryptoPanicPost } from './types'

const BASE = 'https://cryptopanic.com/api/v1/posts/'
const TIMEOUT_MS = 10_000

export async function collect(): Promise<CollectorResult<CryptoPanicData>> {
  const now = new Date().toISOString()
  const apiKey = process.env.CRYPTOPANIC_API_KEY

  if (!apiKey) {
    return {
      source: 'CryptoPanic',
      success: false,
      data: null,
      error: 'CRYPTOPANIC_API_KEY not configured (optional)',
      collectedAt: now,
    }
  }

  try {
    const url = `${BASE}?auth_token=${apiKey}&public=true&kind=news&filter=hot&regions=en`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`CryptoPanic ${res.status}: ${res.statusText}`)

    const json = (await res.json()) as { results?: CryptoPanicPost[] }
    const posts = (json.results ?? []).slice(0, 10) // Top 10 hot news

    return {
      source: 'CryptoPanic',
      success: true,
      data: { posts },
      collectedAt: now,
    }
  } catch (err) {
    return {
      source: 'CryptoPanic',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      collectedAt: now,
    }
  }
}
