'use client'

import { useEffect, useState } from 'react'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase-client'
import { Profile, REPORT_LABELS, ReportType } from '@/lib/types'

const REPORT_TYPES: ReportType[] = ['pre-market', 'midday', 'closing']

// ─── Prompt Editor ─────────────────────────────────────────────────────────
function PromptEditor() {
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const results: Record<string, string> = {}
      for (const type of REPORT_TYPES) {
        const snap = await getDoc(doc(db, 'promptTemplates', type))
        if (snap.exists()) {
          results[type] = snap.data().promptText
        }
      }
      setTemplates(results)
    }
    load()
  }, [])

  async function savePrompt(type: ReportType) {
    setSaving(type)
    try {
      await updateDoc(doc(db, 'promptTemplates', type), {
        promptText: templates[type],
        updatedAt: new Date(),
      })
      setSaved(type)
      setTimeout(() => setSaved(null), 2000)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      {REPORT_TYPES.map((type) => {
        const label = REPORT_LABELS[type]
        return (
          <div key={type} className="settings-section" style={{ marginBottom: 16 }}>
            <div className="settings-section-header">
              <span style={{ fontSize: '1.2rem' }}>{label.emoji}</span>
              <div>
                <div className="settings-section-title">{label.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Gerado às {label.time} BRT
                </div>
              </div>
            </div>
            <div className="settings-section-body">
              <div className="form-group">
                <label>Texto do prompt</label>
                <textarea
                  value={templates[type] ?? ''}
                  onChange={(e) =>
                    setTemplates((prev) => ({ ...prev, [type]: e.target.value }))
                  }
                  rows={10}
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => savePrompt(type)}
                disabled={saving === type}
              >
                {saved === type ? '✓ Salvo!' : saving === type ? '⏳ Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Manual Generation ─────────────────────────────────────────────────────
function ManualGeneration() {
  const [type, setType] = useState<ReportType>('pre-market')
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function generate() {
    if (!secret.trim()) {
      setResult({ ok: false, message: 'Informe o CRON_SECRET.' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, message: `✅ Relatório gerado! ID: ${data.reportId} (modelo: ${data.model})` })
      } else {
        setResult({ ok: false, message: `❌ Erro: ${data.error}` })
      }
    } catch (err) {
      setResult({ ok: false, message: `❌ Falha de rede: ${err}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <span style={{ fontSize: '1.2rem' }}>⚡</span>
        <div className="settings-section-title">Gerar relatório agora</div>
      </div>
      <div className="settings-section-body">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REPORT_LABELS[t].emoji} {REPORT_LABELS[t].title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 2, minWidth: 200, marginBottom: 0 }}>
            <label>CRON_SECRET</label>
            <input
              type="text"
              placeholder="Cole o CRON_SECRET aqui para autenticar"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? (
            <>
              <span className="spin">⏳</span> Gerando (pode levar 30-60s)...
            </>
          ) : (
            '🚀 Gerar agora'
          )}
        </button>
        {result && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 8,
              background: result.ok ? 'var(--green-glow)' : 'var(--red-glow)',
              color: result.ok ? 'var(--green)' : 'var(--red)',
              fontSize: '0.875rem',
            }}
          >
            {result.message}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Notifications Config ──────────────────────────────────────────────────
function NotificationsConfig() {
  const [config, setConfig] = useState({
    emailTo: [] as string[],
    emailEnabled: false,
    pushEnabled: false,
  })
  const [emailInput, setEmailInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'config', 'notifications')).then((snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setConfig({
          emailTo: data.emailTo ?? [],
          emailEnabled: data.emailEnabled ?? false,
          pushEnabled: data.pushEnabled ?? false,
        })
        setEmailInput((data.emailTo ?? []).join('\n'))
      }
    })
  }, [])

  async function save() {
    setSaving(true)
    try {
      await setDoc(doc(db, 'config', 'notifications'), {
        emailTo: emailInput.split('\n').map((e) => e.trim()).filter(Boolean),
        emailEnabled: config.emailEnabled,
        pushEnabled: config.pushEnabled,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  async function subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Este navegador não suporta push notifications.')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      alert('Permissão de notificação negada.')
      return
    }
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    })
    alert('✅ Notificações push ativadas neste dispositivo!')
  }

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <span style={{ fontSize: '1.2rem' }}>🔔</span>
        <div className="settings-section-title">Notificações</div>
      </div>
      <div className="settings-section-body">
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Notificações por e-mail</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Via Resend, enviado após cada geração
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.emailEnabled}
              onChange={(e) => setConfig((c) => ({ ...c, emailEnabled: e.target.checked }))}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {config.emailEnabled && (
          <div className="form-group" style={{ marginTop: 12 }}>
            <label>E-mails (um por linha)</label>
            <textarea
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="email1@exemplo.com&#10;email2@exemplo.com"
              rows={4}
            />
          </div>
        )}

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Notificações push (Web Push)</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Instale o app e ative por dispositivo
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.pushEnabled}
              onChange={(e) => setConfig((c) => ({ ...c, pushEnabled: e.target.checked }))}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {config.pushEnabled && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={subscribePush}
            style={{ marginTop: 8 }}
          >
            📱 Ativar push neste dispositivo
          </button>
        )}

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saved ? '✓ Salvo!' : saving ? '⏳...' : '💾 Salvar configurações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Profiles Manager ──────────────────────────────────────────────────────
function ProfilesManager() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'profiles'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, (snap) => {
      setProfiles(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Profile, 'id'>),
          createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
        }))
      )
    })
  }, [])

  async function deleteProfile(id: string) {
    if (!confirm('Remover este perfil? As anotações dele permanecerão no histórico.')) return
    setDeleting(id)
    try {
      await deleteDoc(doc(db, 'profiles', id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <span style={{ fontSize: '1.2rem' }}>👥</span>
        <div className="settings-section-title">Perfis ({profiles.length})</div>
      </div>
      <div className="settings-section-body" style={{ padding: 0 }}>
        {profiles.length === 0 ? (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state-desc">Nenhum perfil criado ainda.</div>
          </div>
        ) : (
          profiles.map((p) => (
            <div key={p.id} className="settings-row" style={{ padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: p.color,
                    display: 'inline-block',
                  }}
                />
                <span className="settings-row-label">{p.name}</span>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => deleteProfile(p.id)}
                disabled={deleting === p.id}
              >
                {deleting === p.id ? '...' : 'Remover'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<'prompts' | 'notifications' | 'profiles' | 'generate'>('generate')

  return (
    <div className="container-narrow">
      <div className="page-header">
        <h1 className="page-title">⚙️ Configurações</h1>
        <p className="page-subtitle">Gerencie prompts, notificações, perfis e gere relatórios manualmente.</p>
      </div>

      <div className="section-tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'generate', label: '⚡ Gerar' },
          { key: 'prompts', label: '📝 Prompts' },
          { key: 'notifications', label: '🔔 Notificações' },
          { key: 'profiles', label: '👥 Perfis' },
        ].map((t) => (
          <button
            key={t.key}
            className={`section-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key as typeof activeTab)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'generate' && <ManualGeneration />}
      {activeTab === 'prompts' && <PromptEditor />}
      {activeTab === 'notifications' && <NotificationsConfig />}
      {activeTab === 'profiles' && <ProfilesManager />}
    </div>
  )
}
