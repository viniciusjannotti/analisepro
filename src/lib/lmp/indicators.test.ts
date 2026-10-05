import { test } from 'node:test'
import assert from 'node:assert/strict'
import { atr, adx, sma, relativeVolume, confirmedSwings } from './indicators'
import type { Candle } from './types'

function candle(i: number, high: number, low: number, close: number, volume = 1000): Candle {
  return { date: `d${i}`, open: close, high, low, close, adjClose: close, volume }
}

test('ATR of constant true range equals that range', () => {
  const candles = Array.from({ length: 30 }, (_, i) => candle(i, 101, 99, 100))
  const values = atr(candles, 14)
  assert.equal(values[13], null)
  assert.equal(values[14], 2)
  assert.equal(values[29], 2)
})

test('SMA returns simple averages with nulls during warm-up', () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4])
})

test('ADX of a pure uptrend reaches 100 after warm-up', () => {
  const candles = Array.from({ length: 60 }, (_, i) => candle(i, 100 + i, 99 + i, 99.5 + i))
  const values = adx(candles, 14)
  assert.equal(values[20], null)
  assert.ok(Math.abs((values[59] as number) - 100) < 1e-9)
})

test('relative volume of constant volume is 1', () => {
  const candles = Array.from({ length: 30 }, (_, i) => candle(i, 101, 99, 100, 5000))
  const rv = relativeVolume(candles, 20)
  assert.equal(rv[18], null)
  assert.equal(rv[25], 1)
})

test('swings are not confirmed before window candles exist (no look-ahead)', () => {
  const candles = Array.from({ length: 30 }, (_, i) => candle(i, i === 10 ? 120 : 100, 95, 98))
  const beforeConfirmation = confirmedSwings(candles, 14, 5)
  assert.equal(
    beforeConfirmation.some((s) => s.index === 10 && s.type === 'high'),
    false
  )
  const afterConfirmation = confirmedSwings(candles, 15, 5)
  assert.equal(
    afterConfirmation.some((s) => s.index === 10 && s.type === 'high' && s.price === 120),
    true
  )
})
