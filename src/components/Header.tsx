'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProfiles } from '@/context/ProfileContext'
import { Profile, PROFILE_COLORS } from '@/lib/types'

export function Header() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: 'Dashboard', emoji: '📊' },
    { href: '/configuracoes', label: 'Configurações', emoji: '⚙️' },
  ]

  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="header-logo">
          <div className="header-logo-icon">📡</div>
          <span className="header-logo-text">
            Analise<span>Pro</span>
          </span>
        </Link>

        <nav className="header-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname === item.href ? 'active' : ''}`}
            >
              {item.emoji} {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}

/* ─── Profile Creation Modal ───────────────────────────────────── */
function ProfileModal({ onClose }: { onClose: () => void }) {
  const { createProfile, profiles, suggestedColor } = useProfiles()
  const [name, setName] = useState('')
  const [color, setColor] = useState(suggestedColor)
  const [loading, setLoading] = useState(false)

  const usedColors = profiles.map((p) => p.color)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await createProfile(name.trim(), color)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Criar perfil</span>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="profile-name">Nome</label>
            <input
              id="profile-name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={32}
            />
          </div>

          <div className="form-group">
            <label>Cor do perfil</label>
            <div className="color-grid">
              {PROFILE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch ${color === c ? 'selected' : ''}`}
                  style={{
                    background: c,
                    opacity: usedColors.includes(c) && c !== color ? 0.4 : 1,
                  }}
                  onClick={() => setColor(c)}
                  title={usedColors.includes(c) ? 'Já em uso' : c}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={!name.trim() || loading}
          >
            {loading ? '⏳ Criando...' : '✓ Criar perfil'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ─── Profile Bar ──────────────────────────────────────────────── */
export function ProfileBar() {
  const { profiles, activeProfile, setActiveProfile, loading } = useProfiles()
  const [showModal, setShowModal] = useState(false)

  if (loading) {
    return (
      <div className="profile-bar">
        <div className="profile-bar-inner">
          <div className="skeleton" style={{ width: 80, height: 28, borderRadius: 100 }} />
          <div className="skeleton" style={{ width: 70, height: 28, borderRadius: 100 }} />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="profile-bar">
        <div className="profile-bar-inner">
          {profiles.length === 0 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Nenhum perfil — crie um →
            </span>
          )}
          {profiles.map((profile: Profile) => (
            <button
              key={profile.id}
              className={`profile-tab ${activeProfile?.id === profile.id ? 'active' : ''}`}
              onClick={() => setActiveProfile(profile)}
              style={
                activeProfile?.id === profile.id
                  ? { borderColor: profile.color, color: profile.color }
                  : {}
              }
            >
              <span
                className="profile-dot"
                style={{ background: profile.color }}
              />
              {profile.name}
            </button>
          ))}

          <button
            className="profile-tab-add"
            onClick={() => setShowModal(true)}
            aria-label="Criar novo perfil"
            title="Criar novo perfil"
          >
            +
          </button>
        </div>
      </div>

      {showModal && <ProfileModal onClose={() => setShowModal(false)} />}
    </>
  )
}
