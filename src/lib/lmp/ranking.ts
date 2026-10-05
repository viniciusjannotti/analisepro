import type { MapaPreco } from './mapa'

export const RR_MINIMO = 1.5
export const TOP_N_PADRAO = 10
const LIQUIDEZ_REFERENCIA = 5_000_000

export function indiceTriagem(m: MapaPreco): number {
  const { adx, sma20, sma50, sma200, valorNegociadoMedio } = m.indicadores
  const T = (Math.min(adx, 40) / 40) * (sma20 > sma50 && sma50 > sma200 ? 1 : 0.7)
  const P =
    m.caminho === 'livre' ? 1 : m.caminho === 'com_obstaculos' ? 1 - 0.25 * m.obstaculos.length : 0
  const R = Math.min(m.rr, 3) / 3
  const Q = Math.min(valorNegociadoMedio / (5 * LIQUIDEZ_REFERENCIA), 1)
  return 100 * (0.3 * T + 0.3 * P + 0.25 * R + 0.15 * Q)
}

export interface CandidatoRankeado {
  ticker: string
  indiceTriagem: number
  mapa: MapaPreco
}

export function montarRanking(
  mapas: MapaPreco[],
  rrMinimo = RR_MINIMO,
  topN = TOP_N_PADRAO
): CandidatoRankeado[] {
  return mapas
    .filter((m) => m.caminho !== 'bloqueado' && m.rr >= rrMinimo)
    .map((m) => ({ ticker: m.ticker, indiceTriagem: indiceTriagem(m), mapa: m }))
    .sort((a, b) => b.indiceTriagem - a.indiceTriagem)
    .slice(0, topN)
}
