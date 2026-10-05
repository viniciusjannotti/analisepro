export interface Candle {
  date: string
  open: number
  high: number
  low: number
  close: number
  adjClose: number
  volume: number
}

export interface DataProvider {
  getDailyCandles(ticker: string, fromDate: string, toDate: string): Promise<Candle[]>
}
