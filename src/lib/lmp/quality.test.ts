import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkQuality } from './quality'
import type { Candle } from './types'

// Consecutive weekdays starting 2025-01-06 (a Monday), so the last date is predictable.
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

function series(count: number, opts: { volume?: number; jumpAt?: number } = {}): Candle[] {
  const dates = weekdayDates(count)
  return dates.map((date, i) => {
    const close = opts.jumpAt === i ? 200 : 100 + (i % 2)
    return {
      date,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      adjClose: close,
      volume: opts.volume ?? 1000,
    }
  })
}

test('healthy series with recent last candle passes', () => {
  const candles = series(300)
  const asOf = candles[candles.length - 1].date
  assert.deepEqual(checkQuality(candles, asOf), { ok: true, motivos: [], alertas: [] })
})

test('short history fails', () => {
  const candles = series(100)
  const result = checkQuality(candles, candles[candles.length - 1].date)
  assert.equal(result.ok, false)
  assert.match(result.motivos[0], /histórico curto/)
})

test('stale last candle (more than 3 business days) fails', () => {
  const candles = series(300)
  const result = checkQuality(candles, '2026-03-31')
  assert.equal(result.ok, false)
  assert.ok(result.motivos.some((m) => /mais de 3 dias úteis/.test(m)))
})

test('an extreme one-day move is flagged for review, not rejected', () => {
  const candles = series(300, { jumpAt: 290 })
  const result = checkQuality(candles, candles[candles.length - 1].date)
  assert.equal(result.ok, true)
  assert.equal(result.motivos.length, 0)
  assert.ok(result.alertas.some((m) => /verificar/.test(m)))
})

test('more than 20% zero-volume candles in last 60 fails', () => {
  const candles = series(300)
  for (let i = candles.length - 13; i < candles.length; i++) candles[i].volume = 0
  const result = checkQuality(candles, candles[candles.length - 1].date)
  assert.equal(result.ok, false)
  assert.ok(result.motivos.some((m) => /volume zero/.test(m)))
})
