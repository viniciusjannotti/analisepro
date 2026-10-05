import type { Candle, DataProvider } from './types'
import { atr, averageTradedValue, sma } from './indicators'
import { checkQuality } from './quality'

export interface ScreenerParams {
  liquidezMinima: number
  precoMinimo: number
  extensaoMaximaATR: number
  variacaoDiaMaxima: number
  atrPctMinimo: number
}

export const PARAMS_PADRAO: ScreenerParams = {
  liquidezMinima: 5_000_000,
  precoMinimo: 2,
  extensaoMaximaATR: 1.5,
  variacaoDiaMaxima: 0.07,
  atrPctMinimo: 0.018,
}

export type FiltroId = 'liquidez' | 'preco' | 'tendencia' | 'extensao' | 'variacaoDia' | 'volatilidade'

export interface FiltroResultado {
  id: FiltroId
  passou: boolean
  valor: number | null
  limite: string
  descricao: string
}

const DESCRICOES: Record<FiltroId, string> = {
  liquidez:
    'Quanto dinheiro, em média, passa pela ação por pregão nos últimos 20 dias (preço × volume). Mede se é fácil entrar e sair.',
  preco: 'Preço de fechamento do último pregão. Ações muito baratas costumam ter comportamento errático.',
  tendencia:
    'Distância do fechamento até a média móvel de 50 dias (ex.: 0,05 = 5% acima). Passa só se o preço está acima da média de 50, a de 50 está acima da de 200 e subindo nos últimos 10 pregões.',
  extensao:
    'Quantas vezes o ATR o preço está acima da média de 20 dias. Valores altos indicam que a ação subiu rápido demais e pode recuar.',
  variacaoDia: 'Variação percentual do último pregão em relação ao fechamento anterior.',
  volatilidade:
    'ATR dividido pelo preço: quanto a ação oscila por dia em média. Abaixo do mínimo, é pouco provável chegar ao alvo de +5% em poucos pregões.',
}

export interface ResultadoAtivo {
  ticker: string
  aprovado: boolean
  filtros: FiltroResultado[]
  motivosReprovacao: string[]
  flags: string[]
  fechamento: number | null
  atr: number | null
  atrPct: number | null
}

const fmt = (n: number | null) => (n === null ? 'n/d' : n.toFixed(4))

export function avaliarAtivo(
  ticker: string,
  candles: Candle[],
  asOfDate: string,
  params: ScreenerParams = PARAMS_PADRAO
): ResultadoAtivo {
  const q = checkQuality(candles, asOfDate)
  const flags = [...q.alertas, 'verificar balanço']

  if (!q.ok) {
    return {
      ticker,
      aprovado: false,
      filtros: [],
      motivosReprovacao: q.motivos.map((m) => `dados: ${m}`),
      flags,
      fechamento: null,
      atr: null,
      atrPct: null,
    }
  }

  const n = candles.length
  const last = candles[n - 1]
  const prevClose = candles[n - 2].close
  const closes = candles.map((c) => c.close)
  const sma20 = sma(closes, 20)[n - 1] as number
  const sma50Series = sma(closes, 50)
  const sma50 = sma50Series[n - 1] as number
  const sma50HaDezPregoes = sma50Series[n - 11] as number
  const sma200 = sma(closes, 200)[n - 1] as number
  const atrValor = atr(candles, 14)[n - 1] as number
  const liquidez = averageTradedValue(candles, 20)[n - 1] as number
  const variacao = last.close / prevClose - 1
  const atrPct = atrValor / last.close
  const extensao = atrValor > 0 ? (last.close - sma20) / atrValor : null

  const filtrosBase: Omit<FiltroResultado, 'descricao'>[] = [
    {
      id: 'liquidez',
      passou: liquidez >= params.liquidezMinima,
      valor: liquidez,
      limite: `valor negociado médio 20d ≥ R$ ${params.liquidezMinima.toLocaleString('pt-BR')}`,
    },
    {
      id: 'preco',
      passou: last.close >= params.precoMinimo,
      valor: last.close,
      limite: `preço ≥ R$ ${params.precoMinimo}`,
    },
    {
      id: 'tendencia',
      passou: last.close > sma50 && sma50 > sma200 && sma50 > sma50HaDezPregoes,
      valor: last.close / sma50 - 1,
      limite: 'fechamento > SMA50, SMA50 > SMA200 e SMA50 subindo nos últimos 10 pregões',
    },
    {
      id: 'extensao',
      passou: extensao !== null && extensao <= params.extensaoMaximaATR,
      valor: extensao,
      limite: `(fechamento − SMA20) / ATR ≤ ${params.extensaoMaximaATR}`,
    },
    {
      id: 'variacaoDia',
      passou: variacao <= params.variacaoDiaMaxima,
      valor: variacao,
      limite: `variação do dia ≤ +${(params.variacaoDiaMaxima * 100).toFixed(0)}%`,
    },
    {
      id: 'volatilidade',
      passou: atrPct >= params.atrPctMinimo,
      valor: atrPct,
      limite: `ATR% ≥ ${(params.atrPctMinimo * 100).toFixed(1)}%`,
    },
  ]

  const filtros: FiltroResultado[] = filtrosBase.map((f) => ({ ...f, descricao: DESCRICOES[f.id] }))

  const motivosReprovacao = filtros
    .filter((f) => !f.passou)
    .map((f) => `${f.id}: ${fmt(f.valor)} (limite: ${f.limite})`)

  return {
    ticker,
    aprovado: motivosReprovacao.length === 0,
    filtros,
    motivosReprovacao,
    flags,
    fechamento: last.close,
    atr: atrValor,
    atrPct,
  }
}

export interface ExecucaoScreener {
  status: 'ok' | 'parcial'
  universoTotal: number
  analisadas: number
  aprovadosEtapa1: number
  falhas: Array<{ ticker: string; motivo: string }>
  resultados: ResultadoAtivo[]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function buscarComRetry(
  provider: DataProvider,
  ticker: string,
  from: string,
  to: string,
  tentativas: number,
  backoffMs: number
): Promise<Candle[]> {
  let ultimo: unknown
  for (let i = 0; i < tentativas; i++) {
    try {
      return await provider.getDailyCandles(ticker, from, to)
    } catch (err) {
      ultimo = err
      if (i < tentativas - 1) await sleep(backoffMs * 2 ** i)
    }
  }
  throw ultimo
}

export async function executarScreener(args: {
  universo: string[]
  provider: DataProvider
  asOfDate: string
  params?: ScreenerParams
  concorrencia?: number
  tentativas?: number
  backoffMs?: number
  diasHistorico?: number
}): Promise<ExecucaoScreener> {
  const params = args.params ?? PARAMS_PADRAO
  const concorrencia = args.concorrencia ?? 5
  const tentativas = args.tentativas ?? 3
  const backoffMs = args.backoffMs ?? 500
  const diasHistorico = args.diasHistorico ?? 450

  const asOf = new Date(`${args.asOfDate}T00:00:00Z`)
  const from = new Date(asOf.getTime() - diasHistorico * 86_400_000).toISOString().slice(0, 10)

  const resultados: ResultadoAtivo[] = []
  const falhas: Array<{ ticker: string; motivo: string }> = []
  let indice = 0

  const worker = async () => {
    while (indice < args.universo.length) {
      const ticker = args.universo[indice++]
      try {
        const candles = await buscarComRetry(args.provider, ticker, from, args.asOfDate, tentativas, backoffMs)
        resultados.push(avaliarAtivo(ticker, candles, args.asOfDate, params))
      } catch (err) {
        falhas.push({ ticker, motivo: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  await Promise.all(Array.from({ length: concorrencia }, worker))

  const parcial = args.universo.length > 0 && falhas.length / args.universo.length > 0.2
  return {
    status: parcial ? 'parcial' : 'ok',
    universoTotal: args.universo.length,
    analisadas: resultados.length,
    aprovadosEtapa1: resultados.filter((r) => r.aprovado).length,
    falhas,
    resultados,
  }
}
