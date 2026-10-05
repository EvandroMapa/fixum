'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { salvarSessaoAdmin, verificarAdminNoServidor, enviarCodigoAdmin, confirmarCodigoAdmin } from '@/lib/admin-auth'
import InputSenha from '@/components/ui/InputSenha'
import styles from './page.module.css'
import Icone from '@/components/ui/Icone'

/**
 * Login do painel executivo: e-mail + senha → código de 6 dígitos enviado por e-mail (obrigatório).
 * Quem decide se a conta é admin e se o código foi confirmado é o servidor (/api/admin/sessao e /api/admin/codigo).
 */
type Etapa = 'verificando' | 'credenciais' | 'codigo_email'

export default function AdminLoginPage() {
  const router = useRouter()
  const [etapa, setEtapa] = useState<Etapa>('verificando')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [usuarioSessaoAtiva, setUsuarioSessaoAtiva] = useState<User | null>(null)
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null)

  // Consulta o servidor e leva a pessoa para a etapa certa (ou para dentro do painel)
  const avancarConformeServidor = useCallback(async (usuario: User) => {
    const verificacao = await verificarAdminNoServidor()
    if (verificacao.ok) {
      salvarSessaoAdmin(usuario.email || '')
      router.push('/admin')
      return
    }
    if (verificacao.etapa === 'codigo_email') {
      setUsuarioSessaoAtiva(usuario)
      setCodigo('')
      setEtapa('codigo_email')
      const envio = await enviarCodigoAdmin()
      if (envio.ok) setAvisoEnvio(`Enviamos um código de 6 dígitos para ${usuario.email}.`)
      else setErro(envio.erro || 'Não foi possível enviar o código.')
      return
    }
    setUsuarioSessaoAtiva(null)
    setEtapa('credenciais')
    if (verificacao.codigo === 'nao_admin') {
      setErro(`A conta "${usuario.email}" não tem permissão de administrador.`)
      await createClient().auth.signOut()
    }
  }, [router])

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      if (user) void avancarConformeServidor(user)
      else setEtapa('credenciais')
    })
  }, [avancarConformeServidor])

  async function handleTrocarConta() {
    await createClient().auth.signOut()
    setUsuarioSessaoAtiva(null)
    setEmail('')
    setSenha('')
    setCodigo('')
    setErro(null)
    setEtapa('credenciais')
  }

  async function handleCredenciais(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const { data, error } = await createClient().auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error || !data.user) {
        setErro('Credenciais de administrador inválidas. Verifique o e-mail e a senha.')
        return
      }
      await avancarConformeServidor(data.user)
    } finally {
      setCarregando(false)
    }
  }

  async function handleConfirmarCodigo(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    try {
      const resultado = await confirmarCodigoAdmin(codigo)
      if (!resultado.ok) {
        setErro(resultado.erro || 'Código incorreto.')
        return
      }
      if (usuarioSessaoAtiva) await avancarConformeServidor(usuarioSessaoAtiva)
    } finally {
      setCarregando(false)
    }
  }

  async function handleReenviarCodigo() {
    setErro(null)
    const envio = await enviarCodigoAdmin()
    if (envio.ok) setAvisoEnvio(`Enviamos um novo código para ${usuarioSessaoAtiva?.email}.`)
    else setErro(envio.erro || 'Não foi possível enviar o código.')
  }

  return (
    <div className={styles.paginaLogin}>
      <div className={styles.cardLogin}>
        <div className={styles.cabecalho}>
          <div className={styles.escudoIcone}><Icone nome="escudo" tamanho={16} /></div>
          <h1 className={styles.titulo}>Painel executivo Fixum</h1>
          <p className={styles.subtitulo}>
            {etapa === 'codigo_email'
              ? 'Confirme o acesso com o código enviado ao seu e-mail'
              : 'Acesso restrito para administradores autorizados'}
          </p>
        </div>

        {erro && (
          <div className={styles.alertaErro}>
            <span><Icone nome="alerta" tamanho={16} /></span>
            <span>{erro}</span>
          </div>
        )}

        {usuarioSessaoAtiva && (
          <div style={{
            background: 'rgba(44, 95, 138, 0.12)',
            border: '1px solid rgba(44, 95, 138, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#A39A8A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Conta conectada
              </div>
              <div style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: 700, wordBreak: 'break-all' }}>
                {usuarioSessaoAtiva.email}
              </div>
            </div>
            <button
              type="button"
              onClick={handleTrocarConta}
              style={{
                background: '#3F3B34',
                border: 'none',
                borderRadius: '8px',
                color: '#FAF7F1',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '6px 10px',
                minHeight: '36px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Sair desta conta para entrar com outras credenciais"
            >
              Trocar conta
            </button>
          </div>
        )}

        {etapa === 'verificando' && (
          <p className={styles.subtitulo} style={{ textAlign: 'center' }}>Verificando sessão…</p>
        )}

        {etapa === 'credenciais' && (
          <form onSubmit={handleCredenciais} className={styles.formulario}>
            <div className={styles.grupoInput}>
              <label htmlFor="admin-email" className={styles.label}>E-mail de administrador</label>
              <input
                id="admin-email"
                name="username"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fixum.com.br"
                className={styles.input}
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            <div className={styles.grupoInput}>
              <label htmlFor="admin-password" className={styles.label}>Senha</label>
              <InputSenha
                id="admin-password"
                name="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••••••"
                className={styles.input}
                estiloDark={true}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className={styles.btnEntrar} disabled={carregando}>
              {carregando ? 'Entrando...' : 'Continuar'}
            </button>
          </form>
        )}

        {etapa === 'codigo_email' && (
          <form onSubmit={handleConfirmarCodigo} className={styles.formulario}>
            {avisoEnvio && !erro && (
              <p className={styles.subtitulo} style={{ margin: 0 }}>{avisoEnvio}</p>
            )}
            <div className={styles.grupoInput}>
              <label htmlFor="admin-codigo-email" className={styles.label}>Código do e-mail</label>
              <input
                id="admin-codigo-email"
                className={`${styles.input} ${styles.inputPin}`}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
              />
            </div>

            <button type="submit" className={styles.btnEntrar} disabled={carregando || codigo.length < 6}>
              {carregando ? 'Verificando...' : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={handleReenviarCodigo}
              className={styles.linkVoltar}
              style={{ background: 'none', border: 0, cursor: 'pointer', minHeight: 44 }}
            >
              Não recebeu? Enviar novo código
            </button>
          </form>
        )}

        <div className={styles.rodape}>
          <Link href="/" className={styles.linkVoltar}>
            ← Voltar ao site principal
          </Link>
        </div>
      </div>
    </div>
  )
}
