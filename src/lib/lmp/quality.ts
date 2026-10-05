import type { Candle } from './types'

export interface QualityResult {
  ok: boolean
  motivos: string[]
  alertas: string[]
}

function weekdaysBetween(fromDate: string, toDate: string): number {
  const start = new Date(`${fromDate}T00:00:00Z`)
  const end = new Date(`${toDate}T00:00:00Z`)
  let count = 0
  for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

export function checkQuality(candles: Candle[], asOfDate: string): QualityResult {
  const motivos: string[] = []
  const alertas: string[] = []

  if (candles.length < 250) {
    motivos.push(`histórico curto: ${candles.length} candles (mínimo 250)`)
  }

  if (candles.length > 0) {
    const lastDate = candles[candles.length - 1].date
    if (weekdaysBetween(lastDate, asOfDate) > 3) {
      motivos.push(`último candle em ${lastDate}, mais de 3 dias úteis antes de ${asOfDate}`)
    }
  }

  const window = candles.slice(-251)
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1].close
    if (prev <= 0) continue
    const ret = window[i].close / prev - 1
    if (Math.abs(ret) > 0.4) {
      alertas.push(`verificar: retorno de ${(ret * 100).toFixed(1)}% em ${window[i].date} (movimento extremo, pode ser real ou erro de desdobramento)`)
      break
    }
  }

  const last60 = candles.slice(-60)
  const zeroVolume = last60.filter((c) => c.volume === 0).length
  if (last60.length > 0 && zeroVolume / last60.length > 0.2) {
    motivos.push(`${zeroVolume} de ${last60.length} candles recentes com volume zero`)
  }

  return { ok: motivos.length === 0, motivos, alertas }
}
