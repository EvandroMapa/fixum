'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { iniciarCadastroTotp, confirmarCodigoTotp, type NovoFatorTotp } from '@/lib/auth/mfa-cliente'
import styles from './FluxoEntrada.module.css'

interface Props {
  /** Chamado depois que o app autenticador foi confirmado (a sessão já está em aal2) */
  aoConcluir: () => void | Promise<void>
  aoCancelar?: () => void
  textoBotao?: string
}

/** Cadastro do app autenticador: QR code → código de 6 dígitos → confirmado. */
export default function CadastroTotp({ aoConcluir, aoCancelar, textoBotao = 'Ativar verificação em duas etapas' }: Props) {
  const [fator, setFator] = useState<NovoFatorTotp | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let ativo = true
    iniciarCadastroTotp(createClient())
      .then((novo) => { if (ativo) setFator(novo) })
      .catch((e: Error) => { if (ativo) setErro(e.message) })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [])

  async function handleConfirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!fator) return
    setErro('')
    setCarregando(true)
    try {
      await confirmarCodigoTotp(createClient(), fator.id, codigo)
      await aoConcluir()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível confirmar o código.')
      setCarregando(false)
    }
  }

  async function copiarSegredo() {
    if (!fator) return
    try {
      await navigator.clipboard.writeText(fator.segredo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  return (
    <form onSubmit={handleConfirmar} className={styles.form}>
      <ol className={styles.passos}>
        <li>Instale um app autenticador no celular (Google Authenticator, Microsoft Authenticator ou Authy).</li>
        <li>No app, escaneie o QR code abaixo.</li>
        <li>Digite o código de 6 dígitos que aparecer no app.</li>
      </ol>

      {fator && (
        <>
          <div className={styles.qrCaixa}>
            {/* QR code em SVG gerado pelo Supabase */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fator.qrCode} alt="QR code para o app autenticador" />
          </div>

          <div className={styles.campo}>
            <label>Não consegue escanear? Digite esta chave no app:</label>
            <div className={styles.segredo}>
              <span>{fator.segredo}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copiarSegredo}>
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>

          <div className={styles.campo}>
            <label htmlFor="codigo-totp-cadastro">Código do app</label>
            <input
              id="codigo-totp-cadastro"
              className={`campo ${styles.campoCodigo}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
        </>
      )}

      {erro && <div className={styles.erro}>{erro}</div>}

      <button
        type="submit"
        className={`btn btn-primario ${styles.btnPrincipal}`}
        disabled={carregando || !fator || codigo.length < 6}
      >
        {carregando && !fator ? 'Gerando QR code…' : carregando ? 'Confirmando…' : textoBotao}
      </button>

      {aoCancelar && (
        <div className={styles.acoesSecundarias}>
          <button type="button" className={styles.link} onClick={aoCancelar}>Cancelar</button>
        </div>
      )}
    </form>
  )
}
