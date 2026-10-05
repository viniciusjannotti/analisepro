import type { CandidatoFinal } from './pipeline'

export interface Narrativa {
  resumo: string
  cenarioFavoravel: string
  cenarioInvalidacao: string
  atencao: string
}

// Constantes estruturais da metodologia (janelas, percentuais de referência) que podem aparecer no texto.
const CONSTANTES_PERMITIDAS = [1, 2, 3, 5, 7, 10, 14, 20, 50, 60, 120, 200, 252, 0.5, 1.5, 0.25]

export function numerosPermitidos(c: CandidatoFinal): number[] {
  const m = c.mapa
  const valores: number[] = [
    m.fechamento,
    m.atr,
    m.atrPct * 100,
    m.alvo,
    m.distAlvoATR,
    m.invalidacao,
    m.distInvalidacaoATR,
    m.rr,
    m.gapsContados,
    m.indicadores.adx,
    m.indicadores.sma20,
    m.indicadores.sma50,
    m.indicadores.sma200,
    m.indicadores.valorNegociadoMedio,
    m.indicadores.valorNegociadoMedio / 1_000_000,
    c.indiceTriagem,
    ...c.filtros.flatMap((f) => (f.valor === null ? [] : [f.valor, f.valor * 100])),
    ...m.escada.flatMap((k) => [k.preco, k.Gn, k.distanciaATR]),
    ...m.suportes.flatMap((k) => [k.preco, k.Gn, k.distanciaATR]),
    ...CONSTANTES_PERMITIDAS,
  ]
  return valores.filter((v) => Number.isFinite(v))
}

function extrairNumeros(texto: string): number[] {
  const achados = texto.match(/\d+(?:[.,]\d+)?/g) ?? []
  return achados.map((s) => Number(s.replace(',', '.')))
}

function batePermitido(x: number, permitidos: number[]): boolean {
  return permitidos.some((p) => Math.abs(x - p) <= Math.max(0.01, 0.005 * Math.abs(p)))
}

export function textoUsaSomenteNumerosPermitidos(texto: string, permitidos: number[]): boolean {
  return extrairNumeros(texto).every((x) => batePermitido(x, permitidos))
}

// Descarta a narrativa inteira se qualquer campo citar um número que não está nos dados calculados.
export function validarNarrativa(n: Narrativa, permitidos: number[]): Narrativa | null {
  const campos = [n.resumo, n.cenarioFavoravel, n.cenarioInvalidacao, n.atencao]
  return campos.every((t) => textoUsaSomenteNumerosPermitidos(t, permitidos)) ? n : null
}
