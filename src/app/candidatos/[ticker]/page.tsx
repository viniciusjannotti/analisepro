'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase-client'
import { Tooltip } from '@/components/Tooltip'

interface Filtro {
  id: string
  passou: boolean
  valor: number | null
  limite: string
  descricao: string
}

interface ClusterResumo {
  preco: number
  Gn: number
  distanciaATR: number
  familias: string[]
  tipos: string[]
}

interface Mapa {
  fechamento: number
  atr: number
  atrPct: number
  alvo: number
  invalidacao: number
  distInvalidacaoATR: number
  stopLargo: boolean
  rr: number
  caminho: string
  alvoEmResistencia: boolean
  regime: string
  riscoGap: boolean
  gapsContados: number
  escada: ClusterResumo[]
  suportes: ClusterResumo[]
  indicadores: { adx: number; sma20: number; sma50: number; sma200: number; valorNegociadoMedio: number }
}

interface Candidato {
  ticker: string
  indiceTriagem: number
  mapa: Mapa
  filtros: Filtro[]
  flags: string[]
  narrativa?: { resumo: string; cenarioFavoravel: string; cenarioInvalidacao: string; atencao: string } | null
}

const CAMINHO_TEXTO: Record<string, string> = {
  livre: 'livre',
  com_obstaculos: 'com obstáculos',
  bloqueado: 'bloqueado',
}

const REGIME_TEXTO: Record<string, string> = {
  expansao: 'expansão',
  compressao: 'compressão',
  tendencia_alta: 'tendência de alta',
  tendencia_baixa: 'tendência de baixa',
  lateral: 'lateral',
  transicao: 'transição',
}

const NOME_FILTRO: Record<string, string> = {
  liquidez: 'Liquidez',
  preco: 'Preço mínimo',
  tendencia: 'Tendência de alta',
  extensao: 'Não esticado (extensão)',
  variacaoDia: 'Variação do dia',
  volatilidade: 'Volatilidade mínima',
}

const fmt = (n: number, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtData = (iso: string) => iso.split('-').reverse().join('/')

const EXPLICACOES = {
  invalidacao:
    'Nível em que a tese deixa de valer. Usa o suporte relevante mais próximo abaixo do preço, com uma pequena folga, ou 1,5 ATR abaixo do preço se não houver suporte.',
  escada: 'Níveis de preço acima do atual, ordenados pela distância. A barra indica a gravidade: quanto maior, mais relevante é o nível. A gravidade combina quantas famílias de indicadores coincidem, quantas vezes o preço já tocou o nível e quão perto ele está.',
  suportes: 'Níveis de preço abaixo do atual, que podem segurar uma queda.',
  atr: 'Average True Range: quanto a ação oscila por dia em média, em reais e em percentual do preço.',
}

export default function CandidatoDetalhe() {
  return (
    <Suspense fallback={<div className="container"><div className="skeleton" style={{ height: 200 }} /></div>}>
      <Conteudo />
    </Suspense>
  )
}

function Conteudo() {
  const params = useParams<{ ticker: string }>()
  const ticker = params.ticker
  const data = useSearchParams().get('data')
  const [candidato, setCandidato] = useState<Candidato | null | undefined>(undefined)

  useEffect(() => {
    if (!data) return
    getDoc(doc(db, 'screenerRuns', data, 'candidatos', ticker)).then((snap) => {
      setCandidato(snap.exists() ? (snap.data() as Candidato) : null)
    })
  }, [data, ticker])

  if (!data) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">Data da análise não informada</div>
          <Link href="/candidatos" className="btn btn-secondary">← Voltar aos candidatos</Link>
        </div>
      </div>
    )
  }

  if (candidato === undefined) {
    return (
      <div className="container">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    )
  }

  if (candidato === null) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">Candidato não encontrado nesta data</div>
          <Link href="/candidatos" className="btn btn-secondary">← Voltar aos candidatos</Link>
        </div>
      </div>
    )
  }

  const m = candidato.mapa
  const ind = m.indicadores

  return (
    <div className="container">
      <div style={{ marginBottom: 20, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <Link href="/candidatos" style={{ color: 'var(--text-muted)' }}>Candidatos do Dia</Link>
        {' / '}
        <span style={{ color: 'var(--text-secondary)' }}>{candidato.ticker}</span>
      </div>

      <div className="page-header">
        <h1 className="page-title">{candidato.ticker}</h1>
        <p className="page-subtitle">
          Mapa de preço de {data ? fmtData(data) : ''} · fechamento R$ {fmt(m.fechamento)} · índice de triagem {fmt(candidato.indiceTriagem, 1)}
        </p>
      </div>

      <div className="disclaimer">
        Ferramenta de triagem e análise. Não constitui recomendação de investimento. Indicadores heurísticos, ainda não validados por backtest.
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Plano de referência</h3>
        <table className="tactical-table">
          <tbody>
            <tr><td>Alvo (+5%)</td><td>R$ {fmt(m.alvo)}</td></tr>
            <tr>
              <td>
                Invalidação
                <Tooltip texto={EXPLICACOES.invalidacao} />
              </td>
              <td>
                R$ {fmt(m.invalidacao)} ({fmt(m.distInvalidacaoATR)} ATR abaixo)
                {m.stopLargo && <span className="bad"> · stop largo</span>}
              </td>
            </tr>
            <tr><td>Relação risco/retorno</td><td>{fmt(m.rr)}</td></tr>
            <tr><td>Caminho até o alvo</td><td>{CAMINHO_TEXTO[m.caminho] ?? m.caminho}{m.alvoEmResistencia ? ' · alvo em resistência' : ''}</td></tr>
            <tr><td>Regime</td><td>{REGIME_TEXTO[m.regime] ?? m.regime}</td></tr>
            <tr>
              <td>Risco de gap</td>
              <td>{m.riscoGap ? `alto (${m.gapsContados} gaps > 2% nos últimos 60 pregões)` : `baixo (${m.gapsContados} gaps > 2%)`}</td>
            </tr>
          </tbody>
        </table>
        {candidato.flags.length > 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Alertas: {candidato.flags.join('; ')}</p>
        )}
      </div>

      {candidato.narrativa && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Leitura do mapa</h3>
          <p>{candidato.narrativa.resumo}</p>
          <p><strong>Cenário favorável:</strong> {candidato.narrativa.cenarioFavoravel}</p>
          <p><strong>Cenário de invalidação:</strong> {candidato.narrativa.cenarioInvalidacao}</p>
          <p><strong>Atenção:</strong> {candidato.narrativa.atencao}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Texto gerado por IA a partir dos números calculados acima.</p>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          Indicadores
          <Tooltip texto={EXPLICACOES.atr} />
        </h3>
        <table className="tactical-table">
          <tbody>
            <tr><td>ATR (14)</td><td>R$ {fmt(m.atr)} ({fmt(m.atrPct * 100)}% do preço)</td></tr>
            <tr><td>ADX (14)</td><td>{fmt(ind.adx, 1)}</td></tr>
            <tr><td>Média de 20 pregões</td><td>R$ {fmt(ind.sma20)}</td></tr>
            <tr><td>Média de 50 pregões</td><td>R$ {fmt(ind.sma50)}</td></tr>
            <tr><td>Média de 200 pregões</td><td>R$ {fmt(ind.sma200)}</td></tr>
            <tr><td>Valor negociado médio (20d)</td><td>R$ {fmt(ind.valorNegociadoMedio / 1_000_000, 1)} milhões</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          Escada de resistências
          <Tooltip texto={EXPLICACOES.escada} />
        </h3>
        {m.escada.length === 0 ? (
          <p className="muted">Nenhuma resistência acima do preço atual.</p>
        ) : (
          <table className="tactical-table">
            <thead>
              <tr><th>Preço</th><th>Distância (ATR)</th><th>Gravidade</th><th>Famílias</th></tr>
            </thead>
            <tbody>
              {m.escada.map((c) => (
                <tr key={`r${c.preco}`}>
                  <td>R$ {fmt(c.preco)}</td>
                  <td>{fmt(c.distanciaATR)}</td>
                  <td>
                    <div style={{ background: 'var(--card)', borderRadius: 4, height: 8, width: 120 }}>
                      <div style={{ background: 'var(--accent)', borderRadius: 4, height: 8, width: `${Math.min(c.Gn, 100)}%` }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(c.Gn, 0)}/100</span>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{c.familias.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>
          Suportes abaixo do preço
          <Tooltip texto={EXPLICACOES.suportes} />
        </h3>
        {m.suportes.length === 0 ? (
          <p className="muted">Nenhum suporte abaixo do preço atual.</p>
        ) : (
          <table className="tactical-table">
            <thead>
              <tr><th>Preço</th><th>Distância (ATR)</th><th>Gravidade</th><th>Famílias</th></tr>
            </thead>
            <tbody>
              {m.suportes.map((c) => (
                <tr key={`s${c.preco}`}>
                  <td>R$ {fmt(c.preco)}</td>
                  <td>{fmt(c.distanciaATR)}</td>
                  <td>{fmt(c.Gn, 0)}/100</td>
                  <td style={{ fontSize: '0.8rem' }}>{c.familias.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Critérios de triagem</h3>
        <table className="tactical-table">
          <tbody>
            {candidato.filtros.map((f) => (
              <tr key={f.id}>
                <td>
                  <span className={f.passou ? 'ok' : 'bad'}>{f.passou ? '✓' : '✗'}</span>{' '}
                  {NOME_FILTRO[f.id] ?? f.id}
                  <Tooltip texto={f.descricao} />
                </td>
                <td style={{ fontSize: '0.82rem' }}>
                  {f.valor === null ? 'n/d' : fmt(f.valor, 4)} · limite: {f.limite}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
