import type { Candle, DataProvider } from './types'
import { executarScreener, PARAMS_PADRAO, type FiltroResultado, type ScreenerParams } from './screener'
import { analisarMapa, MAPA_PADRAO, type MapaPreco } from './mapa'
import { montarRanking, RR_MINIMO, TOP_N_PADRAO, type CandidatoRankeado } from './ranking'

export type StatusExecucao = 'ok' | 'parcial' | 'sem_novo_pregao' | 'erro'

export interface CandidatoFinal extends CandidatoRankeado {
  filtros: FiltroResultado[]
  flags: string[]
}

export interface Reprovacao {
  ticker: string
  motivos: string[]
}

export interface ResultadoPipeline {
  execucao: {
    status: StatusExecucao
    asOfDate: string
    universoTotal: number
    analisadas: number
    aprovadosEtapa1: number
    candidatasFinais: number
    falhas: Array<{ ticker: string; motivo: string }>
    parametrosUsados: ScreenerParams
  }
  candidatos: CandidatoFinal[]
  reprovados: Reprovacao[]
}

function ultimoPregao(candles: Map<string, Candle[]>): string | null {
  let ultimo: string | null = null
  for (const serie of candles.values()) {
    const data = serie[serie.length - 1]?.date
    if (data && (ultimo === null || data > ultimo)) ultimo = data
  }
  return ultimo
}

export async function executarPipeline(args: {
  universo: string[]
  provider: DataProvider
  asOfDate: string
  params?: ScreenerParams
  topN?: number
  backoffMs?: number
}): Promise<ResultadoPipeline> {
  const params = args.params ?? PARAMS_PADRAO
  const topN = args.topN ?? TOP_N_PADRAO
  const run = await executarScreener({
    universo: args.universo,
    provider: args.provider,
    asOfDate: args.asOfDate,
    params,
    backoffMs: args.backoffMs,
  })

  const ultimo = ultimoPregao(run.candles)
  const cabecalho = {
    asOfDate: args.asOfDate,
    universoTotal: run.universoTotal,
    analisadas: run.analisadas,
    aprovadosEtapa1: run.aprovadosEtapa1,
    parametrosUsados: params,
  }

  if (ultimo === null) {
    return {
      execucao: { ...cabecalho, status: 'erro', candidatasFinais: 0, falhas: run.falhas },
      candidatos: [],
      reprovados: [],
    }
  }
  if (ultimo < args.asOfDate) {
    return {
      execucao: { ...cabecalho, status: 'sem_novo_pregao', candidatasFinais: 0, falhas: run.falhas },
      candidatos: [],
      reprovados: [],
    }
  }

  const reprovados: Reprovacao[] = run.resultados
    .filter((r) => !r.aprovado)
    .map((r) => ({ ticker: r.ticker, motivos: r.motivosReprovacao }))

  const resultadoPorTicker = new Map(run.resultados.map((r) => [r.ticker, r]))
  const mapas: MapaPreco[] = []
  const falhas = [...run.falhas]
  for (const r of run.resultados) {
    if (!r.aprovado) continue
    const serie = run.candles.get(r.ticker)
    const mapa = serie ? analisarMapa(r.ticker, serie, MAPA_PADRAO) : null
    if (mapa) mapas.push(mapa)
    else falhas.push({ ticker: r.ticker, motivo: 'mapa de preço indisponível' })
  }

  const ranking = montarRanking(mapas, RR_MINIMO, Infinity)
  const emRanking = new Set(ranking.map((c) => c.ticker))
  for (const m of mapas) {
    if (emRanking.has(m.ticker)) continue
    const motivos: string[] = []
    if (m.caminho === 'bloqueado') motivos.push('caminho bloqueado por resistência forte')
    if (m.rr < RR_MINIMO) motivos.push(`R:R ${m.rr.toFixed(2)} abaixo do mínimo ${RR_MINIMO}`)
    reprovados.push({ ticker: m.ticker, motivos })
  }

  for (const c of ranking.slice(topN)) {
    reprovados.push({ ticker: c.ticker, motivos: [`fora do top ${topN} (índice ${c.indiceTriagem.toFixed(1)})`] })
  }

  const candidatos: CandidatoFinal[] = ranking.slice(0, topN).map((c) => {
    const r = resultadoPorTicker.get(c.ticker)
    return { ...c, filtros: r?.filtros ?? [], flags: r?.flags ?? [] }
  })

  return {
    execucao: {
      ...cabecalho,
      status: run.status,
      candidatasFinais: candidatos.length,
      falhas,
    },
    candidatos,
    reprovados,
  }
}
