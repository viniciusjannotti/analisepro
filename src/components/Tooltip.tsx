'use client'

import { useState } from 'react'

export function Tooltip({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label="Explicação"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '1px solid var(--text-muted)',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
        }}
      >
        ?
      </button>
      {aberto && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '130%',
            left: 0,
            width: 280,
            padding: 10,
            borderRadius: 8,
            background: 'var(--bg-3)',
            border: '1px solid var(--text-muted)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            fontWeight: 400,
            lineHeight: 1.45,
            textAlign: 'left',
            textTransform: 'none',
            letterSpacing: 'normal',
          }}
        >
          {texto}
        </span>
      )}
    </span>
  )
}
