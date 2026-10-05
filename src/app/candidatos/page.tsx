'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from '@/lib/firebase-client'
import { Tooltip } from '@/components/Tooltip'

interface Filtro {
  id: string
  passou: boolean
  valor: number | null
  descricao: string
}

interface Candidato {
  ticker: string
  indiceTriagem: number
  mapa: {
    fechamento: number
    alvo: number
    invalidacao: number
    rr: number
    caminho: string
    regime: string
  }
  filtros: Filtro[]
  flags: string[]
}

interface Execucao {
  status: string
  analisadas: number
  aprovadosEtapa1: number
  candidatasFinais: number
}

const STATUS_TEXTO: Record<string, string> = {
  ok: 'Execução concluída',
  parcial: 'Execução parcial: alguns ativos não tiveram dados',
  sem_novo_pregao: 'Sem novo pregão nesta data. Nenhuma lista foi gerada.',
  erro: 'Falha na execução',
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

const fmt = (n: number, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtData = (iso: string) => iso.split('-').reverse().join('/')

const EXPLICACOES = {
  indice:
    'Índice de triagem de 0 a 100. Ordena os candidatos combinando tendência, caminho livre até o alvo, relação risco/retorno e liquidez. Não é probabilidade de acerto.',
  alvo: 'Preço-alvo de +5% sobre o fechamento do dia.',
  invalidacao:
    'Nível em que a tese deixa de valer. Usa o suporte relevante mais próximo abaixo do preço, com uma pequena folga, ou 1,5 ATR abaixo do preço se não houver suporte.',
  rr: 'Relação risco/retorno: quanto se ganha até o alvo dividido pelo quanto se perde até a invalidação. Mínimo exigido: 1,5.',
  caminho:
    'Obstáculos entre o preço e o alvo. Livre: nenhum. Com obstáculos: de 1 a 2 resistências relevantes. Bloqueado: 3 ou mais, ou uma resistência muito forte bem perto do preço.',
  regime:
    'Estado atual da volatilidade e da tendência: expansão, compressão, tendência de alta ou de baixa, lateral ou transição.',
  variacao: 'Variação percentual do último pregão.',
  alertas:
    'Avisos que merecem atenção antes de qualquer decisão, como verificar balanço, movimento extremo ou risco de gap.',
}

export default function CandidatosPage() {
  const [datas, setDatas] = useState<string[]>([])
  const [dataSel, setDataSel] = useState<string | null>(null)
  const [execucao, setExecucao] = useState<Execucao | null>(null)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [carregado, setCarregado] = useState(false)
  const [reprovadosCarregados, setReprovadosCarregados] = useState<{
    data: string
    lista: Array<{ ticker: string; motivos: string[] }>
  } | null>(null)
  const reprovados =
    reprovadosCarregados && reprovadosCarregados.data === dataSel ? reprovadosCarregados.lista : null

  useEffect(() => {
    const q = query(collection(db, 'screenerRuns'), orderBy(documentId(), 'desc'), limit(15))
    return onSnapshot(q, (snap) => {
      const ids = snap.docs.map((d) => d.id)
      setDatas(ids)
      setCarregado(true)
      setDataSel((atual) => atual ?? ids[0] ?? null)
    })
  }, [])

  useEffect(() => {
    if (!dataSel) return
    const unsubRun = onSnapshot(doc(db, 'screenerRuns', dataSel), (snap) => {
      setExecucao(snap.exists() ? (snap.data() as Execucao) : null)
    })
    const q = query(collection(db, 'screenerRuns', dataSel, 'candidatos'), orderBy('indiceTriagem', 'desc'))
    const unsubCand = onSnapshot(q, (snap) => {
      setCandidatos(snap.docs.map((d) => d.data() as Candidato))
    })
    return () => {
      unsubRun()
      unsubCand()
    }
  }, [dataSel])

  async function carregarReprovados() {
    if (!dataSel) return
    const snap = await getDocs(collection(db, 'screenerRuns', dataSel, 'reprovados'))
    setReprovadosCarregados({
      data: dataSel,
      lista: snap.docs.map((d) => d.data() as { ticker: string; motivos: string[] }),
    })
  }

  const variacao = (c: Candidato) => c.filtros.find((f) => f.id === 'variacaoDia')?.valor ?? null

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">🎯 Candidatos do Dia</h1>
        <p className="page-subtitle">
          Ações da B3 que passaram nos critérios de triagem para uma operação comprada de 1 a 2 semanas, com alvo de +5%.
        </p>
      </div>

      <div className="disclaimer">
        Ferramenta de triagem e análise. Não constitui recomendação de investimento. Indicadores heurísticos, ainda não validados por backtest.
      </div>

      {!carregado ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : datas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-desc">Nenhuma execução registrada ainda. A lista é gerada após o fechamento dos dias úteis.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '16px 0' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Data da análise{' '}
              <select value={dataSel ?? ''} onChange={(e) => setDataSel(e.target.value)}>
                {datas.map((d) => (
                  <option key={d} value={d}>
                    {fmtData(d)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {execucao && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{STATUS_TEXTO[execucao.status] ?? execucao.status}</div>
              {execucao.status !== 'sem_novo_pregao' && (
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  {execucao.analisadas} analisadas → {execucao.aprovadosEtapa1} passaram nos filtros → {execucao.candidatasFinais} candidatas
                </div>
              )}
            </div>
          )}

          {candidatos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-desc">Nenhum candidato nesta data.</div>
            </div>
          ) : (
            <div className="tactical-table-wrapper">
              <table className="tactical-table">
                <thead>
                  <tr>
                    <th>Ativo</th>
                    <th>Fechamento</th>
                    <th>
                      Variação
                      <Tooltip texto={EXPLICACOES.variacao} />
                    </th>
                    <th>
                      Índice
                      <Tooltip texto={EXPLICACOES.indice} />
                    </th>
                    <th>
                      Regime
                      <Tooltip texto={EXPLICACOES.regime} />
                    </th>
                    <th>
                      Alvo (+5%)
                      <Tooltip texto={EXPLICACOES.alvo} />
                    </th>
                    <th>
                      Invalidação
                      <Tooltip texto={EXPLICACOES.invalidacao} />
                    </th>
                    <th>
                      R:R
                      <Tooltip texto={EXPLICACOES.rr} />
                    </th>
                    <th>
                      Caminho
                      <Tooltip texto={EXPLICACOES.caminho} />
                    </th>
                    <th>
                      Alertas
                      <Tooltip texto={EXPLICACOES.alertas} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {candidatos.map((c) => {
                    const v = variacao(c)
                    return (
                      <tr key={c.ticker}>
                        <td>
                          <Link href={`/candidatos/${c.ticker}?data=${dataSel}`} className="asset-name">
                            {c.ticker}
                          </Link>
                        </td>
                        <td>R$ {fmt(c.mapa.fechamento)}</td>
                        <td>{v === null ? '—' : `${fmt(v * 100)}%`}</td>
                        <td>{fmt(c.indiceTriagem, 1)}</td>
                        <td>{REGIME_TEXTO[c.mapa.regime] ?? c.mapa.regime}</td>
                        <td>R$ {fmt(c.mapa.alvo)}</td>
                        <td>R$ {fmt(c.mapa.invalidacao)}</td>
                        <td>{fmt(c.mapa.rr)}</td>
                        <td>{CAMINHO_TEXTO[c.mapa.caminho] ?? c.mapa.caminho}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.flags.join('; ')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            {reprovados === null ? (
              <button className="btn btn-secondary btn-sm" onClick={carregarReprovados}>
                Ver ativos reprovados e motivos
              </button>
            ) : (
              <div className="tactical-table-wrapper">
                <table className="tactical-table">
                  <thead>
                    <tr>
                      <th>Ativo</th>
                      <th>Motivos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reprovados
                      .slice()
                      .sort((a, b) => a.ticker.localeCompare(b.ticker))
                      .map((r) => (
                        <tr key={r.ticker}>
                          <td>{r.ticker}</td>
                          <td style={{ fontSize: '0.82rem' }}>{r.motivos.join(' · ')}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
