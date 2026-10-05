import type { Candle } from './types'
import { adx, atr, averageTradedValue, sma } from './indicators'
import { analisarNiveis, type Cluster } from './niveis'

export interface MapaParams {
  alvoPct: number
  limiarObstaculoGn: number
  limiarBloqueioGn: number
  distBloqueioATR: number
  limiarSuporteGn: number
  distSuporteMinATR: number
  folgaATR: number
  stopLargoATR: number
}

export const MAPA_PADRAO: MapaParams = {
  alvoPct: 0.05,
  limiarObstaculoGn: 50,
  limiarBloqueioGn: 80,
  distBloqueioATR: 1.5,
  limiarSuporteGn: 30,
  distSuporteMinATR: 0.5,
  folgaATR: 0.25,
  stopLargoATR: 3,
}

export type Caminho = 'livre' | 'com_obstaculos' | 'bloqueado'
export type Regime = 'expansao' | 'compressao' | 'tendencia_alta' | 'tendencia_baixa' | 'lateral' | 'transicao'

export interface ClusterResumo {
  preco: number
  Gn: number
  distanciaATR: number
  familias: string[]
  tipos: string[]
}

export interface MapaPreco {
  ticker: string
  fechamento: number
  atr: number
  atrPct: number
  alvo: number
  distAlvoATR: number
  invalidacao: number
  distInvalidacaoATR: number
  stopLargo: boolean
  rr: number
  caminho: Caminho
  obstaculos: ClusterResumo[]
  escada: ClusterResumo[]
  suportes: ClusterResumo[]
  alvoEmResistencia: boolean
  regime: Regime
  riscoGap: boolean
  gapsContados: number
  indicadores: {
    adx: number
    sma20: number
    sma50: number
    sma200: number
    valorNegociadoMedio: number
  }
  probabilidade: null
}

export function classificarCaminho(
  obstaculos: Array<{ Gn: number; distanciaATR: number }>,
  limiarBloqueioGn: number,
  distBloqueioATR: number
): Caminho {
  if (obstaculos.length >= 3) return 'bloqueado'
  if (obstaculos.some((o) => o.Gn >= limiarBloqueioGn && o.distanciaATR < distBloqueioATR)) return 'bloqueado'
  return obstaculos.length === 0 ? 'livre' : 'com_obstaculos'
}

export function escolherInvalidacao(
  precoAtual: number,
  atrVal: number,
  suportes: Array<{ preco: number; Gn: number }>,
  params: MapaParams = MAPA_PADRAO
): number {
  const validos = suportes.filter(
    (s) => s.Gn >= params.limiarSuporteGn && precoAtual - s.preco >= params.distSuporteMinATR * atrVal
  )
  if (validos.length === 0) return precoAtual - 1.5 * atrVal
  const maisProximo = validos.reduce((a, b) => (b.preco > a.preco ? b : a))
  return maisProximo.preco - params.folgaATR * atrVal
}

export function classificarRegime(p: {
  atr14: number
  atr50: number
  adx: number
  close: number
  sma50: number
  sma50Antes: number
}): Regime {
  const razao = p.atr50 > 0 ? p.atr14 / p.atr50 : 1
  if (razao > 1.25) return 'expansao'
  if (razao < 0.75) return 'compressao'
  if (p.adx >= 25 && p.close > p.sma50 && p.sma50 > p.sma50Antes) return 'tendencia_alta'
  if (p.adx >= 25 && p.close < p.sma50 && p.sma50 < p.sma50Antes) return 'tendencia_baixa'
  if (p.adx < 20) return 'lateral'
  return 'transicao'
}

const resumir = (c: Cluster, precoAtual: number, atrVal: number): ClusterResumo => ({
  preco: c.preco,
  Gn: c.Gn,
  distanciaATR: Math.abs(c.preco - precoAtual) / atrVal,
  familias: c.familias,
  tipos: c.niveis.map((n) => n.tipo),
})

export function analisarMapa(
  ticker: string,
  candles: Candle[],
  params: MapaParams = MAPA_PADRAO
): MapaPreco | null {
  const n = candles.length
  const niveis = analisarNiveis(candles)
  if (!niveis) return null

  const { precoAtual, atr: atrVal, clusters } = niveis
  const alvo = precoAtual * (1 + params.alvoPct)
  const resistencias = clusters.filter((c) => c.lado === 'resistencia')
  const suportes = clusters.filter((c) => c.lado === 'suporte')

  const obstaculosBrutos = resistencias.filter(
    (c) => c.preco > precoAtual && c.preco < alvo && c.Gn >= params.limiarObstaculoGn
  )
  const caminho = classificarCaminho(
    obstaculosBrutos.map((o) => ({ Gn: o.Gn, distanciaATR: (o.preco - precoAtual) / atrVal })),
    params.limiarBloqueioGn,
    params.distBloqueioATR
  )

  const alvoEmResistencia = resistencias.some(
    (c) => c.Gn >= params.limiarObstaculoGn && Math.abs(c.preco - alvo) <= 0.5 * atrVal
  )

  const invalidacao = escolherInvalidacao(
    precoAtual,
    atrVal,
    suportes.map((s) => ({ preco: s.preco, Gn: s.Gn })),
    params
  )
  const distInvalidacaoATR = (precoAtual - invalidacao) / atrVal
  const rr = (alvo - precoAtual) / (precoAtual - invalidacao)

  const closes = candles.map((c) => c.close)
  const sma50Serie = sma(closes, 50)
  const adxValor = adx(candles, 14)[n - 1]
  const atr50 = atr(candles, 50)[n - 1]
  const atr14 = atr(candles, 14)[n - 1]
  const sma50 = sma50Serie[n - 1]
  const sma50Antes = sma50Serie[n - 11]
  const sma20 = sma(closes, 20)[n - 1]
  const sma200 = sma(closes, 200)[n - 1]
  const valorMedio = averageTradedValue(candles, 20)[n - 1]
  if (
    adxValor === null || atr50 === null || atr14 === null || sma50 === null ||
    sma50Antes === null || sma20 === null || sma200 === null || valorMedio === null
  ) {
    return null
  }

  const regime = classificarRegime({
    atr14,
    atr50,
    adx: adxValor,
    close: precoAtual,
    sma50,
    sma50Antes,
  })

  let gaps = 0
  for (let i = Math.max(1, n - 60); i < n; i++) {
    if (Math.abs(candles[i].open / candles[i - 1].close - 1) > 0.02) gaps++
  }

  return {
    ticker,
    fechamento: precoAtual,
    atr: atrVal,
    atrPct: atrVal / precoAtual,
    alvo,
    distAlvoATR: (alvo - precoAtual) / atrVal,
    invalidacao,
    distInvalidacaoATR,
    stopLargo: distInvalidacaoATR > params.stopLargoATR,
    rr,
    caminho,
    obstaculos: obstaculosBrutos.map((c) => resumir(c, precoAtual, atrVal)),
    escada: resistencias.filter((c) => c.preco > precoAtual).map((c) => resumir(c, precoAtual, atrVal)),
    suportes: suportes.filter((c) => c.preco < precoAtual).map((c) => resumir(c, precoAtual, atrVal)),
    alvoEmResistencia,
    regime,
    riscoGap: gaps >= 3,
    gapsContados: gaps,
    indicadores: {
      adx: adxValor,
      sma20,
      sma50,
      sma200,
      valorNegociadoMedio: valorMedio,
    },
    probabilidade: null,
  }
}
