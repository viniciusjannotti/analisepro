import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avaliarAtivo, executarScreener } from './screener'
import type { Candle, DataProvider } from './types'

// Consecutive weekdays from 2025-01-06, so asOf is predictable.
function weekdayDates(count: number): string[] {
  const out: string[] = []
  const d = new Date('2025-01-06T00:00:00Z')
  while (out.length < count) {
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

// Rising series: close = 50 + 0.05 i, intraday range ±1 (ATR ≈ 2, ATR% ≈ 3%).
function tendencia(count = 300, opts: { volume?: number; halfRange?: number; saltoFinal?: number } = {}): Candle[] {
  const dates = weekdayDates(count)
  const half = opts.halfRange ?? 1
  return dates.map((date, i) => {
    let close = 50 + 0.05 * i
    if (opts.saltoFinal && i === count - 1) close *= 1 + opts.saltoFinal
    return {
      date,
      open: close,
      high: close + half,
      low: close - half,
      close,
      adjClose: close,
      volume: opts.volume ?? 1_000_000,
    }
  })
}

const asOf = (candles: Candle[]) => candles[candles.length - 1].date

test('a liquid, trending, moderately volatile stock passes every filter', () => {
  const candles = tendencia()
  const r = avaliarAtivo('OK3', candles, asOf(candles))
  assert.equal(r.aprovado, true)
  assert.equal(r.filtros.length, 6)
  assert.ok(r.filtros.every((f) => f.passou))
  assert.ok(r.filtros.every((f) => f.descricao.length > 0))
  assert.deepEqual(r.motivosReprovacao, [])
  assert.ok(r.flags.includes('verificar balanço'))
})

test('low traded value is rejected with the liquidity reason recorded', () => {
  const candles = tendencia(300, { volume: 1000 })
  const r = avaliarAtivo('ILIQ', candles, asOf(candles))
  assert.equal(r.aprovado, false)
  assert.equal(r.filtros.find((f) => f.id === 'liquidez')?.passou, false)
  assert.ok(r.motivosReprovacao.some((m) => m.startsWith('liquidez:')))
})

test('too-low volatility is rejected by the ATR% filter', () => {
  const candles = tendencia(300, { halfRange: 0.05 })
  const r = avaliarAtivo('CALMA', candles, asOf(candles))
  assert.equal(r.aprovado, false)
  assert.equal(r.filtros.find((f) => f.id === 'volatilidade')?.passou, false)
})

test('a large one-day jump fails the daily variation filter and is recorded', () => {
  const candles = tendencia(300, { saltoFinal: 0.12 })
  const r = avaliarAtivo('SALTO', candles, asOf(candles))
  assert.equal(r.aprovado, false)
  assert.equal(r.filtros.find((f) => f.id === 'variacaoDia')?.passou, false)
  assert.ok(r.motivosReprovacao.some((m) => m.startsWith('variacaoDia:')))
})

test('insufficient history is rejected with a data reason and no filter results', () => {
  const candles = tendencia(100)
  const r = avaliarAtivo('CURTO', candles, asOf(candles))
  assert.equal(r.aprovado, false)
  assert.equal(r.filtros.length, 0)
  assert.ok(r.motivosReprovacao[0].startsWith('dados:'))
})

test('a failing ticker is recorded and the run is marked parcial above 20% failures', async () => {
  const candles = tendencia()
  const provider: DataProvider = {
    async getDailyCandles(ticker) {
      if (ticker === 'ERRO') throw new Error('timeout')
      return candles
    },
  }
  const run = await executarScreener({
    universo: ['OK1', 'OK2', 'ERRO', 'OK3'],
    provider,
    asOfDate: asOf(candles),
    tentativas: 2,
    backoffMs: 1,
  })
  assert.equal(run.universoTotal, 4)
  assert.equal(run.analisadas, 3)
  assert.equal(run.aprovadosEtapa1, 3)
  assert.deepEqual(run.falhas.map((f) => f.ticker), ['ERRO'])
  assert.equal(run.status, 'parcial')
})

test('a run with no failures is marked ok', async () => {
  const candles = tendencia()
  const provider: DataProvider = { async getDailyCandles() { return candles } }
  const run = await executarScreener({
    universo: ['A', 'B'],
    provider,
    asOfDate: asOf(candles),
    backoffMs: 1,
  })
  assert.equal(run.status, 'ok')
  assert.equal(run.falhas.length, 0)
})
