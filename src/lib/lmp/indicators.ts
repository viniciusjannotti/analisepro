import type { Candle } from './types'

type Series = (number | null)[]

export function trueRanges(candles: Candle[]): number[] {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low
    const prevClose = candles[i - 1].close
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose))
  })
}

export function atr(candles: Candle[], period = 14): Series {
  const trs = trueRanges(candles)
  const out: Series = candles.map(() => null)
  if (candles.length <= period) return out

  let prev = trs.slice(1, period + 1).reduce((a, b) => a + b, 0) / period
  out[period] = prev
  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period
    out[i] = prev
  }
  return out
}

export function sma(values: number[], period: number): Series {
  const out: Series = values.map(() => null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function adx(candles: Candle[], period = 14): Series {
  const out: Series = candles.map(() => null)
  if (candles.length <= 2 * period) return out

  const trs = trueRanges(candles)
  const plusDM: number[] = [0]
  const minusDM: number[] = [0]
  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high
    const downMove = candles[i - 1].low - candles[i].low
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }

  let sTR = trs.slice(1, period + 1).reduce((a, b) => a + b, 0)
  let sPlus = plusDM.slice(1, period + 1).reduce((a, b) => a + b, 0)
  let sMinus = minusDM.slice(1, period + 1).reduce((a, b) => a + b, 0)

  const dxAt = (plus: number, minus: number, tr: number) => {
    const plusDI = tr === 0 ? 0 : (100 * plus) / tr
    const minusDI = tr === 0 ? 0 : (100 * minus) / tr
    const sum = plusDI + minusDI
    return sum === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / sum
  }

  const dx: number[] = []
  dx[period] = dxAt(sPlus, sMinus, sTR)
  for (let i = period + 1; i < candles.length; i++) {
    sTR = sTR - sTR / period + trs[i]
    sPlus = sPlus - sPlus / period + plusDM[i]
    sMinus = sMinus - sMinus / period + minusDM[i]
    dx[i] = dxAt(sPlus, sMinus, sTR)
  }

  let prevAdx = dx.slice(period, 2 * period).reduce((a, b) => a + b, 0) / period
  out[2 * period - 1] = prevAdx
  for (let i = 2 * period; i < candles.length; i++) {
    prevAdx = (prevAdx * (period - 1) + dx[i]) / period
    out[i] = prevAdx
  }
  return out
}

export function relativeVolume(candles: Candle[], period = 20): Series {
  const volAvg = sma(candles.map((c) => c.volume), period)
  return candles.map((c, i) => {
    const avg = volAvg[i]
    return avg && avg > 0 ? c.volume / avg : null
  })
}

export function averageTradedValue(candles: Candle[], period = 20): Series {
  return sma(candles.map((c) => c.close * c.volume), period)
}

export interface Swing {
  index: number
  type: 'high' | 'low'
  price: number
}

/**
 * Swings confirmed as of `asOfIndex` only: a swing at i needs candles up to i+window,
 * so it is excluded until asOfIndex >= i+window (no look-ahead).
 */
export function confirmedSwings(candles: Candle[], asOfIndex: number, window = 5): Swing[] {
  const swings: Swing[] = []
  const last = Math.min(asOfIndex - window, candles.length - 1 - window)
  for (let i = window; i <= last; i++) {
    let isHigh = true
    let isLow = true
    for (let j = i - window; j <= i + window; j++) {
      if (candles[j].high > candles[i].high) isHigh = false
      if (candles[j].low < candles[i].low) isLow = false
    }
    if (isHigh) swings.push({ index: i, type: 'high', price: candles[i].high })
    if (isLow) swings.push({ index: i, type: 'low', price: candles[i].low })
  }
  return swings
}
