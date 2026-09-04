'use client'

// Login page — pre-built but not linked in any navigation menu.
// Activate this by wrapping routes in middleware when auth is needed.
// The Firebase Auth SDK is already installed (see src/lib/firebase-client.ts).

import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: activate auth — import { signInWithEmailAndPassword } from 'firebase/auth'
    // and call signInWithEmailAndPassword(auth, email, password)
    alert('Autenticação não ativa por enquanto. Configure em src/lib/firebase-client.ts.')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg-0)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: 'linear-gradient(135deg, #4f8fff, #7c3aed)',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              margin: '0 auto 16px',
            }}
          >
            📡
          </div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}
          >
            AnalisePro
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Painel de Inteligência de Mercado
          </p>
        </div>

        <div className="card">
          <h2
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: 20,
              color: 'var(--text-primary)',
            }}
          >
            Entrar
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">E-mail</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Senha</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            >
              Entrar
            </button>
          </form>

          <p
            style={{
              marginTop: 16,
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}
          >
            Autenticação não está ativa nesta versão.{' '}
            <Link href="/">Ir para o app →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
