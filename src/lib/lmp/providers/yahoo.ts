import type { Candle, DataProvider } from '../types'

// yahoo-finance2 is unofficial and can break without notice — keep it behind DataProvider.
export class YahooProvider implements DataProvider {
  async getDailyCandles(ticker: string, fromDate: string, toDate: string): Promise<Candle[]> {
    const { default: YahooFinance } = await import('yahoo-finance2')
    const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

    const fimExclusivo = new Date(new Date(`${toDate}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
    const result = await yahoo.chart(`${ticker}.SA`, {
      period1: fromDate,
      period2: fimExclusivo,
      interval: '1d',
      return: 'array',
    })

    const candles: Candle[] = []
    for (const q of result.quotes) {
      if (q.open == null || q.high == null || q.low == null || q.close == null || q.volume == null) continue
      const adj = q.adjclose ?? q.close
      const factor = q.close > 0 ? adj / q.close : 1
      candles.push({
        date: q.date.toISOString().slice(0, 10),
        open: q.open * factor,
        high: q.high * factor,
        low: q.low * factor,
        close: adj,
        adjClose: adj,
        volume: q.volume,
      })
    }
    return candles
  }
}
