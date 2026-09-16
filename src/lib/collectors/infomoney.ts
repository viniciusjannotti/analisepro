// ─── InfoMoney RSS Collector ─────────────────────────────────────────────────
// Fetches latest Brazilian market headlines from InfoMoney's public RSS feed.
// No API key required. Parses XML using fast-xml-parser.

import { XMLParser } from 'fast-xml-parser'
import type { CollectorResult, InfoMoneyData, InfoMoneyHeadline } from './types'

const RSS_URL = 'https://www.infomoney.com.br/feed/'
const TIMEOUT_MS = 10_000

export async function collect(): Promise<CollectorResult<InfoMoneyData>> {
  const now = new Date().toISOString()

  try {
    const res = await fetch(RSS_URL, {
      headers: {
        'User-Agent': 'AnalisePro/1.0 (market-intelligence-bot)',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) throw new Error(`InfoMoney RSS ${res.status}: ${res.statusText}`)

    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false })
    const parsed = parser.parse(xml)

    // Navigate RSS structure: rss > channel > item[]
    const items: Array<{ title?: string; link?: string; pubDate?: string }> =
      parsed?.rss?.channel?.item ?? []

    const headlines: InfoMoneyHeadline[] = (Array.isArray(items) ? items : [items])
      .slice(0, 10)
      .filter((item) => item.title)
      .map((item) => ({
        title: String(item.title),
        link: String(item.link ?? ''),
        pubDate: String(item.pubDate ?? ''),
      }))

    return {
      source: 'InfoMoney',
      success: true,
      data: { headlines },
      collectedAt: now,
    }
  } catch (err) {
    return {
      source: 'InfoMoney',
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      collectedAt: now,
    }
  }
}
