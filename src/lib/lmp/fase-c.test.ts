import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agruparNiveis, analisarNiveis, fatorConfluencia, type Nivel } from './niveis'
import { analisarMapa, classificarCaminho, classificarRegime, escolherInvalidacao, MAPA_PADRAO, type MapaPreco } from './mapa'
import { indiceTriagem, montarRanking } from './ranking'
import type { Candle } from './types'

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

const nivel = (preco: number, familia: Nivel['familia'], S: number, tipo = 't'): Nivel => ({ preco, tipo, familia, S })

test('confluence factor counts families, not levels', () => {
  assert.equal(fatorConfluencia(1), 1)
  assert.equal(fatorConfluencia(2), 1.5)
  assert.equal(fatorConfluencia(3), 2)
})

test('levels within 0.25 ATR are fused and the cluster price is S-weighted', () => {
  const grupos = agruparNiveis([nivel(100, 'valor', 0.5), nivel(100.1, 'estrutura', 1)], 1)
  assert.equal(grupos.length, 1)
  assert.equal(grupos[0].niveis.length, 2)
  assert.ok(Math.abs(grupos[0].preco - (100 * 0.5 + 100.1) / 1.5) < 1e-9)

  const separados = agruparNiveis([nivel(100, 'valor', 0.5), nivel(105, 'valor', 0.5)], 1)
  assert.equal(separados.length, 2)
})

test('cluster analysis yields sorted clusters with normalized gravity per side', () => {
  const analise = analisarNiveis(tendencia())
  if (!analise) throw new Error('análise de níveis esperada')
  assert.ok(analise.clusters.length > 0)
  const prices = analise.clusters.map((c) => c.preco)
  assert.deepEqual([...prices].sort((a, b) => a - b), prices)
  for (const c of analise.clusters) {
    assert.ok(c.Gn >= 0 && c.Gn <= 100)
    assert.ok(c.G >= 0)
    assert.ok(c.L >= 1 && c.L <= 1.75)
    assert.ok(c.V >= 0.7 && c.V <= 1.3)
  }
  const resistencias = analise.clusters.filter((c) => c.lado === 'resistencia')
  const suportes = analise.clusters.filter((c) => c.lado === 'suporte')
  if (resistencias.length > 0) assert.equal(Math.max(...resistencias.map((c) => c.Gn)), 100)
  if (suportes.length > 0) assert.equal(Math.max(...suportes.map((c) => c.Gn)), 100)
})

test('path classification: free, with obstacles, and blocked', () => {
  const lim = MAPA_PADRAO.limiarBloqueioGn
  const dist = MAPA_PADRAO.distBloqueioATR
  assert.equal(classificarCaminho([], lim, dist), 'livre')
  assert.equal(classificarCaminho([{ Gn: 60, distanciaATR: 2 }], lim, dist), 'com_obstaculos')
  assert.equal(
    classificarCaminho(
      [
        { Gn: 60, distanciaATR: 1 },
        { Gn: 60, distanciaATR: 2 },
        { Gn: 55, distanciaATR: 3 },
      ],
      lim,
      dist
    ),
    'bloqueado'
  )
  assert.equal(classificarCaminho([{ Gn: 85, distanciaATR: 1 }], lim, dist), 'bloqueado')
  assert.equal(classificarCaminho([{ Gn: 85, distanciaATR: 2 }], lim, dist), 'com_obstaculos')
})

test('invalidation uses the nearest qualifying support minus a fold, or 1.5 ATR fallback', () => {
  assert.equal(escolherInvalidacao(100, 2, [], MAPA_PADRAO), 97)
  assert.equal(escolherInvalidacao(100, 2, [{ preco: 95, Gn: 40 }], MAPA_PADRAO), 94.5)
  assert.equal(escolherInvalidacao(100, 2, [{ preco: 99.5, Gn: 90 }], MAPA_PADRAO), 97)
  assert.equal(escolherInvalidacao(100, 2, [{ preco: 90, Gn: 10 }], MAPA_PADRAO), 97)
})

test('regime follows the precedence order', () => {
  const base = { atr14: 2, atr50: 2, adx: 15, close: 100, sma50: 100, sma50Antes: 100 }
  assert.equal(classificarRegime({ ...base, atr14: 3 }), 'expansao')
  assert.equal(classificarRegime({ ...base, atr14: 1 }), 'compressao')
  assert.equal(classificarRegime({ ...base, adx: 30, close: 105, sma50: 100, sma50Antes: 99 }), 'tendencia_alta')
  assert.equal(classificarRegime({ ...base, adx: 15 }), 'lateral')
  assert.equal(classificarRegime({ ...base, adx: 22 }), 'transicao')
})

test('price map is internally consistent for a trending stock', () => {
  const mapa = analisarMapa('TEND', tendencia())
  assert.ok(mapa)
  assert.ok(Math.abs(mapa.alvo - mapa.fechamento * 1.05) < 1e-9)
  assert.ok(mapa.invalidacao < mapa.fechamento)
  assert.ok(mapa.rr > 0 && Number.isFinite(mapa.rr))
  assert.equal(mapa.probabilidade, null)
  assert.ok(['livre', 'com_obstaculos', 'bloqueado'].includes(mapa.caminho))
  assert.ok(['expansao', 'compressao', 'tendencia_alta', 'tendencia_baixa', 'lateral', 'transicao'].includes(mapa.regime))
  assert.ok(mapa.indicadores.adx >= 0)
})

function mapaBase(): MapaPreco {
  const m = analisarMapa('BASE', tendencia())
  if (!m) throw new Error('mapa esperado')
  return m
}

test('ranking excludes blocked paths and low risk/reward, then sorts by index', () => {
  const base = mapaBase()
  const mapas: MapaPreco[] = [
    { ...base, ticker: 'A', caminho: 'livre', rr: 2.5 },
    { ...base, ticker: 'B', caminho: 'bloqueado', rr: 3 },
    { ...base, ticker: 'C', caminho: 'livre', rr: 1.0 },
    { ...base, ticker: 'D', caminho: 'livre', rr: 1.8 },
  ]
  const ranking = montarRanking(mapas)
  const tickers = ranking.map((r) => r.ticker)
  assert.ok(tickers.includes('A') && tickers.includes('D'))
  assert.ok(!tickers.includes('B') && !tickers.includes('C'))
  for (let i = 1; i < ranking.length; i++) {
    assert.ok(ranking[i - 1].indiceTriagem >= ranking[i].indiceTriagem)
  }
  assert.equal(montarRanking(mapas, 1.5, 1).length, 1)
})

test('triage index stays within 0-100', () => {
  const idx = indiceTriagem(mapaBase())
  assert.ok(idx >= 0 && idx <= 100)
})
