'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase-client'
import { Report, REPORT_LABELS } from '@/lib/types'

function formatDate(date: Date | undefined) {
  if (!date) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}

function ReportCardSkeleton() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="skeleton" style={{ height: 20, width: '40%' }} />
      <div className="skeleton" style={{ height: 16, width: '80%' }} />
      <div className="skeleton" style={{ height: 14, width: '60%' }} />
      <div className="skeleton" style={{ height: 14, width: '70%' }} />
    </div>
  )
}

function ReportCard({ report, featured }: { report: Report; featured?: boolean }) {
  const label = REPORT_LABELS[report.type]
  const preview = report.macroSection?.slice(0, 160) ?? ''

  return (
    <Link href={`/relatorio/${report.id}`} className={`report-card ${featured ? 'featured' : ''}`}>
      <div className="report-card-header">
        <div className="report-type-badge">
          {label.emoji} {report.type}
        </div>
        <span className="report-time">
          {formatDate(report.generatedAt)}
        </span>
      </div>

      <div className="report-card-title">{label.title}</div>

      {report.status === 'error' ? (
        <div style={{ color: 'var(--red)', fontSize: '0.85rem' }}>
          ⚠️ Falha na geração: {report.errorMessage}
        </div>
      ) : (
        <div className="report-card-preview">
          {preview.replace(/[#*_\[\]]/g, '').trim()}
        </div>
      )}

      {featured && (
        <div
          style={{
            marginTop: 12,
            fontSize: '0.75rem',
            color: 'var(--accent)',
            fontWeight: 600,
          }}
        >
          🔴 Mais recente · {report.tacticalTable?.length ?? 0} oportunidades
        </div>
      )}
    </Link>
  )
}

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'reports'),
      orderBy('generatedAt', 'desc'),
      limit(30)
    )

    const unsub = onSnapshot(q, (snap) => {
      const data: Report[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Report, 'id'>),
        generatedAt: doc.data().generatedAt?.toDate?.() ?? new Date(),
      }))
      setReports(data)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const [featured, ...rest] = reports

  return (
    <div className="container">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">📡 Painel de Mercado</h1>
        <p className="page-subtitle">
          Relatórios gerados automaticamente às 08:00, 11:00 e 18:00 (BRT)
        </p>
      </div>

      {loading ? (
        <div className="reports-grid">
          {[...Array(6)].map((_, i) => (
            <ReportCardSkeleton key={i} />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">Nenhum relatório ainda</div>
          <div className="empty-state-desc">
            Os relatórios são gerados automaticamente 3x ao dia. Você pode gerar um manualmente em{' '}
            <Link href="/configuracoes">Configurações</Link>.
          </div>
        </div>
      ) : (
        <>
          {/* Featured — most recent report */}
          {featured && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  marginBottom: 10,
                }}
              >
                Mais Recente
              </div>
              <ReportCard report={featured} featured />
            </div>
          )}

          {/* Rest of reports */}
          {rest.length > 0 && (
            <>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  marginBottom: 12,
                }}
              >
                Histórico
              </div>
              <div className="reports-grid">
                {rest.map((r) => (
                  <ReportCard key={r.id} report={r} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
