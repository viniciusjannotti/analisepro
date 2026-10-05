import { GoogleGenAI } from '@google/genai'
import type { CandidatoFinal } from './lmp/pipeline'
import { numerosPermitidos, validarNarrativa, type Narrativa } from './lmp/narrativa'

// Flash only: no grounding tool, so no paid search quota is used.
const MODELOS = ['gemini-flash-latest', 'gemini-3-flash-preview']

const PROMPT = `Você é um analista. Para cada ativo abaixo, explique em português do Brasil, em linguagem clara e sem prometer resultado, o que a tabela de níveis indica.
Use apenas os números fornecidos; não crie níveis, alvos, preços ou probabilidades; não recomende compra ou venda.
Destaque riscos (balanço, gap, stop largo, alvo em resistência).
Responda somente com o JSON no formato solicitado: uma lista, um item por ativo, com ticker, resumo, cenarioFavoravel, cenarioInvalidacao e atencao.`

const SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      ticker: { type: 'string' },
      resumo: { type: 'string' },
      cenarioFavoravel: { type: 'string' },
      cenarioInvalidacao: { type: 'string' },
      atencao: { type: 'string' },
    },
    required: ['ticker', 'resumo', 'cenarioFavoravel', 'cenarioInvalidacao', 'atencao'],
  },
}

function entradaDoCandidato(c: CandidatoFinal) {
  const m = c.mapa
  return {
    ticker: c.ticker,
    fechamento: m.fechamento,
    alvo: m.alvo,
    invalidacao: m.invalidacao,
    rr: m.rr,
    caminho: m.caminho,
    regime: m.regime,
    indiceTriagem: c.indiceTriagem,
    obstaculos: m.obstaculos.length,
    alvoEmResistencia: m.alvoEmResistencia,
    stopLargo: m.stopLargo,
    riscoGap: m.riscoGap,
    gapsContados: m.gapsContados,
    alertas: c.flags,
    escada: m.escada.map((k) => ({ preco: k.preco, gravidade: k.Gn, distanciaATR: k.distanciaATR })),
    suportes: m.suportes.map((k) => ({ preco: k.preco, gravidade: k.Gn, distanciaATR: k.distanciaATR })),
  }
}

export async function gerarNarrativas(candidatos: CandidatoFinal[]): Promise<Map<string, Narrativa>> {
  const saida = new Map<string, Narrativa>()
  const apiKey = process.env.GEMINI_API_KEY
  if (candidatos.length === 0 || !apiKey) return saida

  const genai = new GoogleGenAI({ apiKey })
  const contents = `${PROMPT}\n\nDADOS:\n${JSON.stringify(candidatos.map(entradaDoCandidato))}`

  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    for (const model of MODELOS) {
      try {
        const res = await genai.models.generateContent({
          model,
          contents,
          config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.4 },
        })
        const itens = JSON.parse(res.text ?? '[]') as Array<Narrativa & { ticker: string }>
        for (const item of itens) {
          const c = candidatos.find((x) => x.ticker === item.ticker)
          if (!c) continue
          const valida = validarNarrativa(
            {
              resumo: item.resumo,
              cenarioFavoravel: item.cenarioFavoravel,
              cenarioInvalidacao: item.cenarioInvalidacao,
              atencao: item.atencao,
            },
            numerosPermitidos(c)
          )
          if (valida) saida.set(item.ticker, valida)
        }
        return saida
      } catch (err) {
        console.warn(`[screener-narrative] tentativa ${tentativa} ${model} falhou:`, err instanceof Error ? err.message : err)
      }
    }
    if (tentativa < 2) await new Promise((r) => setTimeout(r, 3000))
  }
  return saida
}
