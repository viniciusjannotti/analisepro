import { test } from 'node:test'
import assert from 'node:assert/strict'
import { numerosPermitidos, validarNarrativa, type Narrativa } from './narrativa'
import type { CandidatoFinal } from './pipeline'

const candidato = {
  ticker: 'PETR4',
  indiceTriagem: 56.7,
  mapa: {
    fechamento: 51.17,
    atr: 1.24,
    atrPct: 0.0242,
    alvo: 53.73,
    distAlvoATR: 2.1,
    invalidacao: 49.84,
    distInvalidacaoATR: 1.08,
    rr: 1.93,
    gapsContados: 7,
    indicadores: { adx: 34.18, sma20: 48.91, sma50: 46.2, sma200: 40.1, valorNegociadoMedio: 2_500_000_000 },
    escada: [{ preco: 55.1, Gn: 70, distanciaATR: 3.2, familias: ['valor'], tipos: ['sma20'] }],
    suportes: [{ preco: 47.5, Gn: 60, distanciaATR: 2.9, familias: ['estrutura'], tipos: ['minima_60d'] }],
  },
  filtros: [{ id: 'liquidez', passou: true, valor: 2_500_000_000, limite: '', descricao: '' }],
  flags: [],
} as unknown as CandidatoFinal

const base = (texto: string): Narrativa => ({
  resumo: texto,
  cenarioFavoravel: 'Sem números aqui.',
  cenarioInvalidacao: 'Sem números aqui.',
  atencao: 'Acompanhar volume.',
})

test('numbers that exist in the calculated data pass validation', () => {
  const permitidos = numerosPermitidos(candidato)
  const texto = 'O fechamento de 51,17 aponta para o alvo de 53,73, com R:R de 1,93 e invalidação em 49,84.'
  assert.notEqual(validarNarrativa(base(texto), permitidos), null)
})

test('methodology constants such as the 5% target pass validation', () => {
  const permitidos = numerosPermitidos(candidato)
  assert.notEqual(validarNarrativa(base('Alvo de +5% em 10 pregões.'), permitidos), null)
})

test('an invented price is rejected and the whole narrative is dropped', () => {
  const permitidos = numerosPermitidos(candidato)
  assert.equal(validarNarrativa(base('Possível alvo em R$ 77,30 no próximo mês.'), permitidos), null)
})

test('a number hidden in any field invalidates the narrative', () => {
  const permitidos = numerosPermitidos(candidato)
  const n = { ...base('Tudo certo.'), atencao: 'Risco de queda para 12,34.' }
  assert.equal(validarNarrativa(n, permitidos), null)
})
