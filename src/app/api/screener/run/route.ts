import { NextRequest } from 'next/server'
import { YahooProvider } from '@/lib/lmp/providers/yahoo'
import { executarPipeline } from '@/lib/lmp/pipeline'
import { B3_UNIVERSE_INICIAL } from '@/lib/lmp/universe-b3'
import { gravarExecucao } from '@/lib/screener-store'

export const runtime = 'nodejs'
export const maxDuration = 300

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token === process.env.CRON_SECRET && !!token
}

function dataDeReferencia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

async function executar(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const asOfDate = dataDeReferencia()
  const resultado = await executarPipeline({
    universo: B3_UNIVERSE_INICIAL,
    provider: new YahooProvider(),
    asOfDate,
  })
  await gravarExecucao(asOfDate, resultado)

  const { status, analisadas, aprovadosEtapa1, candidatasFinais, falhas } = resultado.execucao
  return Response.json(
    { asOfDate, status, analisadas, aprovadosEtapa1, candidatasFinais, falhas: falhas.length },
    { status: status === 'erro' ? 500 : 200 }
  )
}

export async function GET(req: NextRequest) {
  return executar(req)
}

export async function POST(req: NextRequest) {
  return executar(req)
}
