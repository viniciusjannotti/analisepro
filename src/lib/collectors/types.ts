// ─── Data Collector Types ────────────────────────────────────────────────────
// Shared interfaces for every collector module in the pipeline.

/** Generic wrapper returned by every collector */
export interface CollectorResult<T> {
  source: string
  success: boolean
  data: T | null
  error?: string
  collectedAt: string // ISO-8601
}

// ─── brapi.dev ───────────────────────────────────────────────────────────────

export interface BrapiQuote {
  symbol: string
  shortName?: string
  regularMarketPrice: number
  regularMarketChangePercent: number
  regularMarketVolume?: number
  currency?: string
  marketCap?: number
}

export interface BrapiCrypto {
  coin: string
  coinName: string
  regularMarketPrice: number
  regularMarketChangePercent: number
  currency: string
}

export interface BrapiData {
  stocks: BrapiQuote[]
  fiis: BrapiQuote[]
  crypto: BrapiCrypto[]
}

// ─── CoinGecko ───────────────────────────────────────────────────────────────

export interface CoinGeckoMarket {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  price_change_percentage_24h: number
  total_volume: number
}

export interface CoinGeckoTrending {
  id: string
  name: string
  symbol: string
  market_cap_rank: number | null
  price_btc: number
  score: number
}

export interface CoinGeckoData {
  topCoins: CoinGeckoMarket[]
  trending: CoinGeckoTrending[]
}

// ─── BCB (Banco Central do Brasil) ───────────────────────────────────────────

export interface BcbSeriesPoint {
  data: string  // dd/MM/yyyy
  valor: string // numeric as string
}

export interface BcbPtaxQuote {
  cotacaoCompra: number
  cotacaoVenda: number
  dataHoraCotacao: string
}

export interface BcbData {
  selic: BcbSeriesPoint | null
  ipca: BcbSeriesPoint | null
  ptax: BcbPtaxQuote | null
}

// ─── Yahoo Finance ───────────────────────────────────────────────────────────

export interface YahooQuote {
  symbol: string
  name: string
  price: number
  changePercent: number
  currency: string
}

export interface YahooData {
  indices: YahooQuote[]
  commodities: YahooQuote[]
  forex: YahooQuote[]
}

// ─── FRED ────────────────────────────────────────────────────────────────────

export interface FredObservation {
  seriesId: string
  seriesName: string
  date: string
  value: string
}

export interface FredData {
  observations: FredObservation[]
}

// ─── CryptoPanic ─────────────────────────────────────────────────────────────

export interface CryptoPanicPost {
  title: string
  url: string
  source: { title: string }
  published_at: string
  votes: {
    positive: number
    negative: number
    important: number
  }
}

export interface CryptoPanicData {
  posts: CryptoPanicPost[]
}

// ─── InfoMoney RSS ───────────────────────────────────────────────────────────

export interface InfoMoneyHeadline {
  title: string
  link: string
  pubDate: string
}

export interface InfoMoneyData {
  headlines: InfoMoneyHeadline[]
}

// ─── Full Snapshot ───────────────────────────────────────────────────────────

export interface MarketSnapshot {
  brapi: CollectorResult<BrapiData>
  coingecko: CollectorResult<CoinGeckoData>
  bcb: CollectorResult<BcbData>
  yahoo: CollectorResult<YahooData>
  fred: CollectorResult<FredData>
  cryptopanic: CollectorResult<CryptoPanicData>
  infomoney: CollectorResult<InfoMoneyData>
}
