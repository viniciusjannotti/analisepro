// ─── Market Data Orchestrator ────────────────────────────────────────────────
// Runs all collectors in parallel, assembles a MarketSnapshot, and formats
// the collected data into a text block ready to inject into the Gemini prompt.

import type { MarketSnapshot } from './types'
import * as brapi from './brapi'
import * as coingecko from './coingecko'
import * as bcb from './bcb'
import * as yahoo from './yahoo'
import * as fred from './fred'
import * as cryptopanic from './cryptopanic'
import * as infomoney from './infomoney'

/**
 * Collect data from all sources in parallel.
 * Never throws — individual failures are captured in each CollectorResult.
 */
export async function collectMarketData(): Promise<{
  snapshot: MarketSnapshot
  formattedContext: string
  successfulSources: string[]
  failedSources: string[]
}> {
  const [brapiRes, coingeckoRes, bcbRes, yahooRes, fredRes, cryptopanicRes, infomoneyRes] =
    await Promise.all([
      brapi.collect(),
      coingecko.collect(),
      bcb.collect(),
      yahoo.collect(),
      fred.collect(),
      cryptopanic.collect(),
      infomoney.collect(),
    ])

  const snapshot: MarketSnapshot = {
    brapi: brapiRes,
    coingecko: coingeckoRes,
    bcb: bcbRes,
    yahoo: yahooRes,
    fred: fredRes,
    cryptopanic: cryptopanicRes,
    infomoney: infomoneyRes,
  }

  const allResults = [brapiRes, coingeckoRes, bcbRes, yahooRes, fredRes, cryptopanicRes, infomoneyRes]
  const successfulSources = allResults.filter((r) => r.success).map((r) => r.source)
  const failedSources = allResults.filter((r) => !r.success).map((r) => r.source)

  const formattedContext = formatMarketContext(snapshot, failedSources)

  return { snapshot, formattedContext, successfulSources, failedSources }
}

// ─── Context Formatter ──────────────────────────────────────────────────────

function formatMarketContext(snapshot: MarketSnapshot, failedSources: string[]): string {
  const now = new Date().toISOString()
  const sections: string[] = []

  sections.push(`=== DADOS DE MERCADO COLETADOS EM ${now} ===\n`)

  // ── B3 Stocks (brapi)
  if (snapshot.brapi.success && snapshot.brapi.data) {
    const { stocks, fiis, crypto } = snapshot.brapi.data

    if (stocks.length > 0) {
      sections.push('## Ações da B3 (fonte: brapi.dev)')
      sections.push('| Ativo | Preço (R$) | Var. Dia (%) | Volume |')
      sections.push('|-------|-----------|-------------|--------|')
      for (const s of stocks) {
        const vol = s.regularMarketVolume
          ? formatVolume(s.regularMarketVolume)
          : 'N/A'
        sections.push(
          `| ${s.symbol} | ${formatNum(s.regularMarketPrice)} | ${formatPct(s.regularMarketChangePercent)} | ${vol} |`
        )
      }
      sections.push('')
    }

    if (fiis.length > 0) {
      sections.push('## FIIs da B3 (fonte: brapi.dev)')
      sections.push('| Ativo | Preço (R$) | Var. Dia (%) |')
      sections.push('|-------|-----------|-------------|')
      for (const f of fiis) {
        sections.push(
          `| ${f.symbol} | ${formatNum(f.regularMarketPrice)} | ${formatPct(f.regularMarketChangePercent)} |`
        )
      }
      sections.push('')
    }

    if (crypto.length > 0) {
      sections.push('## Criptomoedas em BRL (fonte: brapi.dev)')
      sections.push('| Moeda | Preço (BRL) | Var. Dia (%) |')
      sections.push('|-------|-----------|-------------|')
      for (const c of crypto) {
        sections.push(
          `| ${c.coin} (${c.coinName}) | ${formatNum(c.regularMarketPrice)} | ${formatPct(c.regularMarketChangePercent)} |`
        )
      }
      sections.push('')
    }
  }

  // ── Crypto Markets (CoinGecko)
  if (snapshot.coingecko.success && snapshot.coingecko.data) {
    const { topCoins, trending } = snapshot.coingecko.data

    if (topCoins.length > 0) {
      sections.push('## Top Criptomoedas por Market Cap (fonte: CoinGecko)')
      sections.push('| Moeda | Símbolo | Preço (USD) | Var. 24h (%) | Mkt Cap (USD) | Volume 24h |')
      sections.push('|-------|---------|-----------|-------------|--------------|------------|')
      for (const c of topCoins) {
        sections.push(
          `| ${c.name} | ${c.symbol.toUpperCase()} | ${formatNum(c.current_price)} | ${formatPct(c.price_change_percentage_24h)} | ${formatLargeNum(c.market_cap)} | ${formatLargeNum(c.total_volume)} |`
        )
      }
      sections.push('')
    }

    if (trending.length > 0) {
      sections.push('## Altcoins em Alta / Fora do Radar (fonte: CoinGecko — trending)')
      sections.push('| Moeda | Símbolo | Rank Mkt Cap | Score |')
      sections.push('|-------|---------|-------------|-------|')
      for (const t of trending) {
        sections.push(
          `| ${t.name} | ${t.symbol.toUpperCase()} | ${t.market_cap_rank ?? 'N/A'} | ${t.score} |`
        )
      }
      sections.push('')
    }
  }

  // ── Macro Brazil (BCB)
  if (snapshot.bcb.success && snapshot.bcb.data) {
    const { selic, ipca, ptax } = snapshot.bcb.data
    sections.push('## Indicadores Macro Brasil (fonte: Banco Central do Brasil)')
    if (selic) sections.push(`- **SELIC Meta:** ${selic.valor}% a.a. (ref: ${selic.data})`)
    if (ipca) sections.push(`- **IPCA (último mês disponível):** ${ipca.valor}% (ref: ${ipca.data})`)
    if (ptax) {
      sections.push(
        `- **PTAX USD/BRL:** Compra R$${ptax.cotacaoCompra.toFixed(4)} / Venda R$${ptax.cotacaoVenda.toFixed(4)} (${ptax.dataHoraCotacao})`
      )
    }
    sections.push('')
  }

  // ── International (Yahoo Finance)
  if (snapshot.yahoo.success && snapshot.yahoo.data) {
    const { indices, commodities, forex } = snapshot.yahoo.data

    if (indices.length > 0) {
      sections.push('## Índices Internacionais (fonte: Yahoo Finance)')
      sections.push('| Índice | Valor | Var. (%) |')
      sections.push('|--------|-------|---------|')
      for (const i of indices) {
        sections.push(`| ${i.name} | ${formatNum(i.price)} | ${formatPct(i.changePercent)} |`)
      }
      sections.push('')
    }

    if (commodities.length > 0) {
      sections.push('## Commodities (fonte: Yahoo Finance)')
      sections.push('| Commodity | Preço (USD) | Var. (%) |')
      sections.push('|-----------|-----------|---------|')
      for (const c of commodities) {
        sections.push(`| ${c.name} | ${formatNum(c.price)} | ${formatPct(c.changePercent)} |`)
      }
      sections.push('')
    }

    if (forex.length > 0) {
      sections.push('## Forex Global (fonte: Yahoo Finance)')
      sections.push('| Par | Cotação | Var. (%) |')
      sections.push('|-----|---------|---------|')
      for (const f of forex) {
        sections.push(`| ${f.name} | ${formatNum(f.price, 4)} | ${formatPct(f.changePercent)} |`)
      }
      sections.push('')
    }
  }

  // ── US Macro (FRED)
  if (snapshot.fred.success && snapshot.fred.data) {
    sections.push('## Indicadores Macro EUA (fonte: FRED — Federal Reserve)')
    for (const obs of snapshot.fred.data.observations) {
      sections.push(`- **${obs.seriesName}:** ${obs.value}% (data: ${obs.date})`)
    }
    sections.push('')
  }

  // ── Crypto Sentiment (CryptoPanic)
  if (snapshot.cryptopanic.success && snapshot.cryptopanic.data) {
    const posts = snapshot.cryptopanic.data.posts
    if (posts.length > 0) {
      sections.push('## Notícias/Sentimento Cripto (fonte: CryptoPanic)')
      for (const p of posts) {
        const sentiment =
          p.votes.positive > p.votes.negative
            ? '🟢 bullish'
            : p.votes.negative > p.votes.positive
              ? '🔴 bearish'
              : '⚪ neutro'
        sections.push(`- [${sentiment}] ${p.title} (${p.source.title})`)
      }
      sections.push('')
    }
  }

  // ── Headlines (InfoMoney)
  if (snapshot.infomoney.success && snapshot.infomoney.data) {
    const headlines = snapshot.infomoney.data.headlines
    if (headlines.length > 0) {
      sections.push('## Manchetes de Mercado Brasil (fonte: InfoMoney)')
      for (const h of headlines) {
        sections.push(`- ${h.title}`)
      }
      sections.push('')
    }
  }

  // ── Failed sources warning
  if (failedSources.length > 0) {
    sections.push(`⚠️ FONTES INDISPONÍVEIS NESTE CICLO: ${failedSources.join(', ')}`)
    sections.push('(O Gemini deve mencionar essas limitações no relatório.)')
  } else {
    sections.push('✅ Todas as fontes de dados responderam com sucesso.')
  }

  return sections.join('\n')
}

// ─── Formatting Helpers ─────────────────────────────────────────────────────

function formatNum(n: number, decimals = 2): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function formatVolume(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatLargeNum(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return `$${n.toLocaleString('en-US')}`
}
