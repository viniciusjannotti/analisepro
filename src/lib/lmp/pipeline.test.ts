import { test } from 'node:test'
import assert from 'node:assert/strict'
import { executarPipeline } from './pipeline'
import type { Candle, DataProvider } from './types'

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

function tendencia(count = 300): Candle[] {
  return weekdayDates(count).map((date, i) => {
    const close = 50 + 0.05 * i
    return { date, open: close, high: close + 1, low: close - 1, close, adjClose: close, volume: 1_000_000 }
  })
}

const provider = (candles: Candle[]): DataProvider => ({ async getDailyCandles() { return candles } })

test('a session that did not happen yet is reported as sem_novo_pregao with no candidates', async () => {
  const candles = tendencia()
  const result = await executarPipeline({
    universo: ['A', 'B'],
    provider: provider(candles),
    asOfDate: '2030-01-07',
  })
  assert.equal(result.execucao.status, 'sem_novo_pregao')
  assert.equal(result.candidatos.length, 0)
})

test('when no ticker returns data the run is reported as erro', async () => {
  const failing: DataProvider = { async getDailyCandles() { throw new Error('offline') } }
  const result = await executarPipeline({
    universo: ['A', 'B'],
    provider: failing,
    asOfDate: '2025-06-01',
    backoffMs: 1,
  })
  assert.equal(result.execucao.status, 'erro')
  assert.equal(result.execucao.falhas.length, 2)
})

test('every approved ticker is either a candidate or has a recorded exclusion reason', async () => {
  const candles = tendencia()
  const asOfDate = candles[candles.length - 1].date
  const result = await executarPipeline({
    universo: ['A', 'B', 'C'],
    provider: provider(candles),
    asOfDate,
    backoffMs: 1,
  })
  assert.equal(result.execucao.status, 'ok')
  assert.equal(result.execucao.analisadas, 3)
  assert.equal(result.candidatos.length + result.reprovados.length, 3)
  for (const c of result.candidatos) {
    assert.equal(c.filtros.length, 6)
    assert.equal(c.mapa.probabilidade, null)
  }
  for (const r of result.reprovados) assert.ok(r.motivos.length > 0)
})
