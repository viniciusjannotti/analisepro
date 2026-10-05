import type { Candle } from './types'
import { atr, confirmedSwings, relativeVolume, sma } from './indicators'

export type Familia = 'valor' | 'estrutura' | 'matematica'
export type Lado = 'suporte' | 'resistencia'

export interface Nivel {
  preco: number
  tipo: string
  familia: Familia
  S: number
}

export interface Cluster {
  preco: number
  lado: Lado
  niveis: Nivel[]
  familias: Familia[]
  C: number
  S: number
  L: number
  V: number
  toques: number
  distanciaATR: number
  G: number
  Gn: number
}

const FUSAO_ATR = 0.25
const TOQUE_ATR = 0.15
const JANELA_TOQUES = 120

export function fatorConfluencia(familiasDistintas: number): number {
  return 1 + 0.5 * (familiasDistintas - 1)
}

export function construirNiveis(candles: Candle[]): Nivel[] {
  const n = candles.length
  const niveis: Nivel[] = []
  const add = (preco: number | null | undefined, tipo: string, familia: Familia, S: number) => {
    if (preco != null && Number.isFinite(preco)) niveis.push({ preco, tipo, familia, S })
  }

  const janelas: Array<[string, number, number]> = [
    ['252d', 252, 1.0],
    ['60d', 60, 0.8],
    ['20d', 20, 0.6],
  ]
  for (const [nome, tamanho, S] of janelas) {
    if (n < tamanho + 2) continue
    const ini = n - 1 - tamanho
    let hi = -Infinity
    let lo = Infinity
    for (let i = ini; i <= n - 2; i++) {
      hi = Math.max(hi, candles[i].high)
      lo = Math.min(lo, candles[i].low)
    }
    add(hi, `maxima_${nome}`, 'estrutura', S)
    add(lo, `minima_${nome}`, 'estrutura', S)
  }

  if (n >= 2) {
    add(candles[n - 2].high, 'maxima_dia_anterior', 'estrutura', 0.5)
    add(candles[n - 2].low, 'minima_dia_anterior', 'estrutura', 0.5)
  }

  const swings = confirmedSwings(candles, n - 1, 5)
  for (const s of swings) {
    if (s.index >= n - 252) add(s.price, 'swing_confirmado', 'estrutura', 0.7)
  }

  const closes = candles.map((c) => c.close)
  add(sma(closes, 20)[n - 1], 'sma20', 'valor', 0.4)
  add(sma(closes, 50)[n - 1], 'sma50', 'valor', 0.5)
  add(sma(closes, 200)[n - 1], 'sma200', 'valor', 0.6)

  const swingsBaixa = swings.filter((s) => s.type === 'low')
  const swingsAlta = swings.filter((s) => s.type === 'high')
  const ultimoFundo = swingsBaixa[swingsBaixa.length - 1]
  if (ultimoFundo) {
    let pv = 0
    let vol = 0
    for (let i = ultimoFundo.index; i < n; i++) {
      const c = candles[i]
      pv += ((c.high + c.low + c.close) / 3) * c.volume
      vol += c.volume
    }
    if (vol > 0) add(pv / vol, 'vwap_ancorada_fundo', 'valor', 0.5)
  }

  const ultimoTopo = swingsAlta[swingsAlta.length - 1]
  if (ultimoFundo && ultimoTopo && ultimoFundo.index < ultimoTopo.index) {
    const base = ultimoFundo.price
    const topo = ultimoTopo.price
    if (topo > base) {
      const perna = topo - base
      for (const r of [0.382, 0.5, 0.618]) add(topo - perna * r, `fib_${r}`, 'matematica', 0.4)
      for (const e of [1.272, 1.618]) add(base + perna * e, `ext_fib_${e}`, 'matematica', 0.3)
    }
  }

  const mesAtual = candles[n - 1].date.slice(0, 7)
  let idxMesAnterior = -1
  for (let i = n - 1; i >= 0; i--) {
    if (candles[i].date.slice(0, 7) !== mesAtual) {
      idxMesAnterior = i
      break
    }
  }
  if (idxMesAnterior >= 0) {
    const mes = candles[idxMesAnterior].date.slice(0, 7)
    let hi = -Infinity
    let lo = Infinity
    let fechamento = 0
    for (const c of candles) {
      if (c.date.slice(0, 7) === mes) {
        hi = Math.max(hi, c.high)
        lo = Math.min(lo, c.low)
        fechamento = c.close
      }
    }
    const pivo = (hi + lo + fechamento) / 3
    add(pivo, 'pivo_mensal', 'matematica', 0.4)
    add(2 * pivo - lo, 'pivo_mensal_r1', 'matematica', 0.4)
    add(2 * pivo - hi, 'pivo_mensal_s1', 'matematica', 0.4)
    add(pivo + (hi - lo), 'pivo_mensal_r2', 'matematica', 0.4)
    add(pivo - (hi - lo), 'pivo_mensal_s2', 'matematica', 0.4)
  }

  return niveis
}

export function agruparNiveis(niveis: Nivel[], atrVal: number): Array<{ preco: number; niveis: Nivel[] }> {
  const ordenados = [...niveis].sort((a, b) => a.preco - b.preco)
  const grupos: Array<{ preco: number; niveis: Nivel[] }> = []
  for (const nv of ordenados) {
    const atual = grupos[grupos.length - 1]
    if (atual && nv.preco - atual.preco <= FUSAO_ATR * atrVal) {
      atual.niveis.push(nv)
      const peso = atual.niveis.reduce((s, x) => s + x.S, 0)
      atual.preco = atual.niveis.reduce((s, x) => s + x.preco * x.S, 0) / peso
    } else {
      grupos.push({ preco: nv.preco, niveis: [nv] })
    }
  }
  return grupos
}

export interface AnaliseNiveis {
  precoAtual: number
  atr: number
  clusters: Cluster[]
}

export function analisarNiveis(candles: Candle[]): AnaliseNiveis | null {
  const n = candles.length
  const atrVal = atr(candles, 14)[n - 1]
  if (atrVal === null || atrVal <= 0) return null

  const precoAtual = candles[n - 1].close
  const grupos = agruparNiveis(construirNiveis(candles), atrVal)
  const rv = relativeVolume(candles, 20)
  const inicioJanela = Math.max(0, n - JANELA_TOQUES)

  const brutos = grupos.map((g) => {
    const lado: Lado = g.preco > precoAtual ? 'resistencia' : 'suporte'
    const tocados: number[] = []
    for (let i = inicioJanela; i < n; i++) {
      const ref = lado === 'resistencia' ? candles[i].high : candles[i].low
      if (Math.abs(ref - g.preco) <= TOQUE_ATR * atrVal) tocados.push(i)
    }
    const toques = tocados.length
    const L = Math.min(Math.max(1 + 0.25 * (toques - 1), 1), 1.75)
    const rvs = tocados.map((i) => rv[i]).filter((x): x is number => x !== null)
    const V = rvs.length > 0 ? Math.min(Math.max(rvs.reduce((a, b) => a + b, 0) / rvs.length, 0.7), 1.3) : 1
    const familias = [...new Set(g.niveis.map((x) => x.familia))]
    const C = fatorConfluencia(familias.length)
    const S = Math.max(...g.niveis.map((x) => x.S))
    const distanciaATR = Math.abs(g.preco - precoAtual) / atrVal
    const G = (C * S * L * V) / (1 + distanciaATR)
    return { preco: g.preco, lado, niveis: g.niveis, familias, C, S, L, V, toques, distanciaATR, G }
  })

  const clusters: Cluster[] = brutos.map((b) => {
    const gmax = Math.max(...brutos.filter((x) => x.lado === b.lado).map((x) => x.G))
    return { ...b, Gn: gmax > 0 ? (100 * b.G) / gmax : 0 }
  })

  clusters.sort((a, b) => a.preco - b.preco)
  return { precoAtual, atr: atrVal, clusters }
}
