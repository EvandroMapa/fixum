'use client'

import { useState, InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  className?: string
  estiloDark?: boolean
}

export default function InputSenha({ className = 'campo', estiloDark = false, ...props }: Props) {
  const [mostrar, setMostrar] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
      <input
        {...props}
        type={mostrar ? 'text' : 'password'}
        className={className}
        style={{ paddingRight: '44px', width: '100%', ...props.style }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setMostrar((v) => !v)}
        aria-label={mostrar ? 'Ocultar senha' : 'Exibir senha'}
        title={mostrar ? 'Ocultar senha' : 'Exibir senha'}
        style={{
          position: 'absolute',
          right: '12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: estiloDark ? '#94a3b8' : '#64748b',
          transition: 'color 0.15s ease',
          outline: 'none',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = estiloDark ? '#f8fafc' : '#0f172a')}
        onMouseLeave={(e) => (e.currentTarget.style.color = estiloDark ? '#94a3b8' : '#64748b')}
      >
        {mostrar ? (
          /* Olho riscado (Ocultar) */
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          /* Olho aberto (Mostrar) */
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
