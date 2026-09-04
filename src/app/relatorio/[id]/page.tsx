'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { doc, onSnapshot, collection, query, where, onSnapshot as onSnap, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase-client'
import { Report, Annotation, TacticalRow, REPORT_LABELS } from '@/lib/types'
import { useProfiles } from '@/context/ProfileContext'
import ReactMarkdown from 'react-markdown'
import Link from 'next/link'

// ─── Section Tabs ──────────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'macro', label: '🌍 Macro', field: 'macroSection' },
  { key: 'calendar', label: '📅 Calendário', field: 'calendarSection' },
  { key: 'hedge', label: '🛡️ Hedge', field: 'hedgeSection' },
  { key: 'table', label: '🎯 Oportunidades', field: '' },
  { key: 'notes', label: '📝 Notas', field: '' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

// ─── Tactical Table ────────────────────────────────────────────────────────
function TacticalTable({
  rows,
  annotations,
  reportId,
}: {
  rows: TacticalRow[]
  annotations: Annotation[]
  reportId: string
}) {
  const { activeProfile } = useProfiles()

  // Group by segment
  const segments = Array.from(new Set(rows.map((r) => r.segment)))

  function isStarred(rowId: string) {
    return annotations.some((a) => a.rowId === rowId && a.profileId === activeProfile?.id)
  }

  function getStarredProfiles(rowId: string) {
    return annotations.filter((a) => a.rowId === rowId)
  }

  async function toggleStar(row: TacticalRow) {
    if (!activeProfile) {
      alert('Selecione um perfil na barra acima para favoritar.')
      return
    }
    const existing = annotations.find(
      (a) => a.rowId === row.rowId && a.profileId === activeProfile.id
    )
    if (existing) {
      await deleteDoc(doc(db, 'annotations', existing.id))
      return
    }
    await addDoc(collection(db, 'annotations'), {
      profileId: activeProfile.id,
      profileName: activeProfile.name,
      profileColor: activeProfile.color,
      reportId,
      rowId: row.rowId,
      createdAt: serverTimestamp(),
    })
  }

  return (
    <div className="tactical-table-wrapper">
      <table className="tactical-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>Ativo</th>
            <th>Mercado</th>
            <th>Viés</th>
            <th>Racional / Gatilho</th>
            <th>Stop / Risco</th>
            <th>Quem marcou</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((seg) => (
            <>
              <tr className="segment-header" key={`seg-${seg}`}>
                <td colSpan={7}>{seg}</td>
              </tr>
              {rows
                .filter((r) => r.segment === seg)
                .map((row) => {
                  const starred = isStarred(row.rowId)
                  const starredBy = getStarredProfiles(row.rowId)
                  return (
                    <tr key={row.rowId}>
                      <td>
                        <button
                          className={`star-btn ${starred ? 'starred' : ''}`}
                          onClick={() => toggleStar(row)}
                          title={starred ? 'Favoritado' : 'Favoritar'}
                        >
                          {starred ? '★' : '☆'}
                        </button>
                      </td>
                      <td>
                        <span className="asset-name">{row.asset}</span>
                      </td>
                      <td>{row.market}</td>
                      <td>
                        <span className={`bias-badge ${row.bias === 'Compra' ? 'bias-buy' : 'bias-sell'}`}>
                          {row.bias === 'Compra' ? '▲' : '▼'} {row.bias}
                        </span>
                      </td>
                      <td style={{ maxWidth: 260, fontSize: '0.82rem' }}>{row.rationale}</td>
                      <td style={{ maxWidth: 200, fontSize: '0.82rem', color: 'var(--red)' }}>
                        {row.riskPoints}
                      </td>
                      <td>
                        <div className="profile-indicators">
                          {starredBy.map((a) => (
                            <div
                              key={a.profileId}
                              className="profile-indicator"
                              style={{ background: a.profileColor }}
                              title={a.profileName}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Notes Panel ───────────────────────────────────────────────────────────
function NotesPanel({
  reportId,
  annotations,
}: {
  reportId: string
  annotations: Annotation[]
}) {
  const { activeProfile, profiles } = useProfiles()
  const [noteText, setNoteText] = useState('')
  const [activeTab, setActiveTab] = useState<string>('all')
  const [saving, setSaving] = useState(false)

  const generalNotes = annotations.filter((a) => !a.rowId && a.note)

  const filteredNotes =
    activeTab === 'all'
      ? generalNotes
      : generalNotes.filter((a) => a.profileId === activeTab)

  async function submitNote(e: React.FormEvent) {
    e.preventDefault()
    if (!activeProfile || !noteText.trim()) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'annotations'), {
        profileId: activeProfile.id,
        profileName: activeProfile.name,
        profileColor: activeProfile.color,
        reportId,
        note: noteText.trim(),
        createdAt: serverTimestamp(),
      })
      setNoteText('')
    } finally {
      setSaving(false)
    }
  }

  const notingProfiles = profiles.filter((p) =>
    generalNotes.some((n) => n.profileId === p.id)
  )

  function formatTime(date: Date | undefined) {
    if (!date) return ''
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div>
      {/* Add note */}
      {activeProfile ? (
        <form onSubmit={submitNote} style={{ marginBottom: 24 }}>
          <div className="form-group">
            <label>Sua nota (como {activeProfile.name})</label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Adicione uma observação sobre este relatório..."
              rows={3}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!noteText.trim() || saving}
          >
            {saving ? '⏳ Salvando...' : '💬 Publicar nota'}
          </button>
        </form>
      ) : (
        <div className="empty-state" style={{ padding: 24 }}>
          <div className="empty-state-desc">Selecione um perfil para adicionar notas.</div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="section-tabs" style={{ marginBottom: 16 }}>
        <button
          className={`section-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Todos ({generalNotes.length})
        </button>
        {notingProfiles.map((p) => (
          <button
            key={p.id}
            className={`section-tab ${activeTab === p.id ? 'active' : ''}`}
            onClick={() => setActiveTab(p.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span
              className="profile-dot"
              style={{ background: p.color, width: 8, height: 8, display: 'inline-block', borderRadius: '50%' }}
            />
            {p.name}
          </button>
        ))}
      </div>

      {/* Notes list */}
      <div className="notes-panel">
        {filteredNotes.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-icon">💬</div>
            <div className="empty-state-desc">Nenhuma nota ainda.</div>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div key={note.id} className="note-item">
              <div className="note-meta">
                <span
                  className="note-profile-dot"
                  style={{ background: note.profileColor }}
                />
                <span className="note-author">{note.profileName}</span>
                <span className="note-time">{formatTime(note.createdAt)}</span>
              </div>
              <div className="note-text">{note.note}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function ReportPage() {
  const params = useParams()
  const reportId = params?.id as string

  const [report, setReport] = useState<Report | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<SectionKey>('macro')

  // Subscribe to report
  useEffect(() => {
    if (!reportId) return
    const unsub = onSnapshot(doc(db, 'reports', reportId), (snap) => {
      if (!snap.exists()) { setLoading(false); return }
      setReport({
        id: snap.id,
        ...(snap.data() as Omit<Report, 'id'>),
        generatedAt: snap.data().generatedAt?.toDate?.() ?? new Date(),
      })
      setLoading(false)
    })
    return () => unsub()
  }, [reportId])

  // Subscribe to annotations for this report
  useEffect(() => {
    if (!reportId) return
    const q = query(collection(db, 'annotations'), where('reportId', '==', reportId))
    const unsub = onSnap(q, (snap) => {
      setAnnotations(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Annotation, 'id'>),
          createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
        }))
      )
    })
    return () => unsub()
  }, [reportId])

  function formatDate(date: Date | undefined) {
    if (!date) return '—'
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(date)
  }

  if (loading) {
    return (
      <div className="container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 32, width: '50%' }} />
          <div className="skeleton" style={{ height: 20, width: '30%' }} />
          <div className="skeleton" style={{ height: 300 }} />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">Relatório não encontrado</div>
          <Link href="/" className="btn btn-secondary">← Voltar ao dashboard</Link>
        </div>
      </div>
    )
  }

  const label = REPORT_LABELS[report.type]

  return (
    <div className="container">
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>Dashboard</Link>
        {' / '}
        <span style={{ color: 'var(--text-secondary)' }}>{label.title}</span>
      </div>

      {/* Report header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div className="report-type-badge">{label.emoji} {report.type}</div>
          {report.status === 'error' && (
            <div style={{ color: 'var(--red)', fontSize: '0.8rem' }}>⚠️ Erro na geração</div>
          )}
        </div>
        <h1 className="page-title">{label.title}</h1>
        <p className="page-subtitle">
          📅 Gerado em {formatDate(report.generatedAt)}
        </p>
      </div>

      {/* Disclaimer */}
      <div className="disclaimer">
        ⚠️ Este relatório é gerado por IA com fins informativos e não constitui recomendação de investimento.
      </div>

      {/* Section tabs */}
      <div className="section-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            className={`section-tab ${activeSection === s.key ? 'active' : ''}`}
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
            {s.key === 'table' && (
              <span
                style={{
                  marginLeft: 6,
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  borderRadius: 100,
                  padding: '1px 7px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {report.tacticalTable?.length ?? 0}
              </span>
            )}
            {s.key === 'notes' && (
              <span
                style={{
                  marginLeft: 6,
                  background: 'var(--bg-3)',
                  color: 'var(--text-muted)',
                  borderRadius: 100,
                  padding: '1px 7px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {annotations.filter((a) => !a.rowId && a.note).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSection === 'macro' && (
        <div className="card markdown-content">
          <ReactMarkdown>{report.macroSection || '_Sem conteúdo._'}</ReactMarkdown>
        </div>
      )}

      {activeSection === 'calendar' && (
        <div className="card markdown-content">
          <ReactMarkdown>{report.calendarSection || '_Sem conteúdo._'}</ReactMarkdown>
        </div>
      )}

      {activeSection === 'hedge' && (
        <div className="card markdown-content">
          <ReactMarkdown>{report.hedgeSection || '_Sem conteúdo._'}</ReactMarkdown>
        </div>
      )}

      {activeSection === 'table' && (
        <>
          {report.tacticalTable?.length > 0 ? (
            <TacticalTable
              rows={report.tacticalTable}
              annotations={annotations}
              reportId={reportId}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-desc">Nenhuma oportunidade neste relatório.</div>
            </div>
          )}
        </>
      )}

      {activeSection === 'notes' && (
        <NotesPanel reportId={reportId} annotations={annotations} />
      )}

      {/* Sources */}
      {report.sources?.length > 0 && activeSection !== 'notes' && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '0.875rem', marginBottom: 12, color: 'var(--text-muted)' }}>
            Fontes citadas
          </h3>
          <ul className="sources-list">
            {report.sources.map((src, i) => (
              <li key={i} className="source-item">
                <a href={src} target="_blank" rel="noopener noreferrer">
                  {src}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
