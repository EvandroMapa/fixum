'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'
import styles from './ModalConfirmacaoContext.module.css'

export type TipoModal = 'primario' | 'perigo' | 'aviso' | 'sucesso' | 'info'

export interface OpcoesConfirmacao {
  titulo: string
  mensagem: string | ReactNode
  icone?: string
  textoBotaoConfirmar?: string
  textoBotaoCancelar?: string
  tipo?: TipoModal
  destrutivo?: boolean
}

export interface OpcoesAlerta {
  titulo: string
  mensagem: string | ReactNode
  icone?: string
  textoBotaoEntendido?: string
  tipo?: TipoModal
}

interface ModalConfirmacaoContextType {
  confirmar: (opcoes: OpcoesConfirmacao) => Promise<boolean>
  alertar: (opcoes: OpcoesAlerta) => Promise<void>
}

const ModalConfirmacaoContext = createContext<ModalConfirmacaoContextType>({
  confirmar: () => Promise.resolve(false),
  alertar: () => Promise.resolve(),
})

export function useConfirm() {
  return useContext(ModalConfirmacaoContext)
}

interface ModalEstado {
  aberto: boolean
  modo: 'confirmar' | 'alerta'
  opcoes: OpcoesConfirmacao | OpcoesAlerta
  resolver?: (valor: boolean) => void
}

export function ModalConfirmacaoProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalEstado>({
    aberto: false,
    modo: 'confirmar',
    opcoes: { titulo: '', mensagem: '' },
  })

  const confirmar = useCallback((opcoes: OpcoesConfirmacao): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setModal({
        aberto: true,
        modo: 'confirmar',
        opcoes,
        resolver: resolve,
      })
    })
  }, [])

  const alertar = useCallback((opcoes: OpcoesAlerta): Promise<void> => {
    return new Promise<void>((resolve) => {
      setModal({
        aberto: true,
        modo: 'alerta',
        opcoes,
        resolver: () => resolve(),
      })
    })
  }, [])

  function handleConfirmar() {
    if (modal.resolver) modal.resolver(true)
    setModal((prev) => ({ ...prev, aberto: false }))
  }

  function handleCancelar() {
    if (modal.resolver) modal.resolver(false)
    setModal((prev) => ({ ...prev, aberto: false }))
  }

  return (
    <ModalConfirmacaoContext.Provider value={{ confirmar, alertar }}>
      {children}
      {modal.aberto && (
        <ModalVisual
          modo={modal.modo}
          opcoes={modal.opcoes}
          onConfirmar={handleConfirmar}
          onCancelar={handleCancelar}
        />
      )}
    </ModalConfirmacaoContext.Provider>
  )
}

function ModalVisual({
  modo,
  opcoes,
  onConfirmar,
  onCancelar,
}: {
  modo: 'confirmar' | 'alerta'
  opcoes: OpcoesConfirmacao | OpcoesAlerta
  onConfirmar: () => void
  onCancelar: () => void
}) {
  const btnConfirmarRef = useRef<HTMLButtonElement>(null)
  const tipo = opcoes.tipo || (modo === 'confirmar' && (opcoes as OpcoesConfirmacao).destrutivo ? 'perigo' : 'primario')

  useEffect(() => {
    btnConfirmarRef.current?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar()
      if (e.key === 'Enter') onConfirmar()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancelar, onConfirmar])

  // Definir ícone padrão caso não informado
  const iconePadrao = (() => {
    if (opcoes.icone) return opcoes.icone
    if (tipo === 'perigo') return '🗑️'
    if (tipo === 'aviso') return '⚠️'
    if (tipo === 'sucesso') return '🎉'
    if (tipo === 'info') return 'ℹ️'
    return '✨'
  })()

  const classeIcone = {
    primario: styles.iconePrimario,
    perigo: styles.iconePerigo,
    aviso: styles.iconeAviso,
    sucesso: styles.iconeSucesso,
    info: styles.iconeInfo,
  }[tipo]

  const classeBtnConfirmar = {
    primario: styles.btnPrimario,
    perigo: styles.btnPerigo,
    aviso: styles.btnAviso,
    sucesso: styles.btnSucesso,
    info: styles.btnPrimario,
  }[tipo]

  return (
    <div className={styles.overlay} onClick={onCancelar}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Cabeçalho com Ícone Temático */}
        <div className={`${styles.circuloIcone} ${classeIcone}`}>
          <span>{iconePadrao}</span>
        </div>

        {/* Título e Mensagem */}
        <div className={styles.conteudo}>
          <h3 className={styles.titulo}>{opcoes.titulo}</h3>
          <div className={styles.mensagem}>
            {typeof opcoes.mensagem === 'string' ? (
              <p>{opcoes.mensagem}</p>
            ) : (
              opcoes.mensagem
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className={styles.rodape}>
          {modo === 'confirmar' && (
            <button
              type="button"
              className={styles.btnCancelar}
              onClick={onCancelar}
            >
              {(opcoes as OpcoesConfirmacao).textoBotaoCancelar || 'Cancelar'}
            </button>
          )}

          <button
            ref={btnConfirmarRef}
            type="button"
            className={`${styles.btnAcao} ${classeBtnConfirmar}`}
            onClick={onConfirmar}
          >
            {modo === 'confirmar'
              ? (opcoes as OpcoesConfirmacao).textoBotaoConfirmar || 'Confirmar'
              : (opcoes as OpcoesAlerta).textoBotaoEntendido || 'Entendi'}
          </button>
        </div>
      </div>
    </div>
  )
}