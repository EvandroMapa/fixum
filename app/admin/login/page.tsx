'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { CHAVE_SECRETA_ADMIN_PADRAO, salvarSessaoAdmin } from '@/lib/admin-auth'
import InputSenha from '@/components/ui/InputSenha'
import styles from './page.module.css'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [chaveSecreta, setChaveSecreta] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [usuarioSessaoAtiva, setUsuarioSessaoAtiva] = useState<any>(null)
  const [verificandoSessao, setVerificandoSessao] = useState(true)

  useEffect(() => {
    async function checarSessao() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Verificar estritamente se o usuário autenticado É ADMINISTRADOR
          const { data: perfil } = await supabase
            .from('perfis')
            .select('is_admin, tipo')
            .eq('id', user.id)
            .maybeSingle()

          const ehAdmin = (
            user.email === 'admin@fixum.com.br' ||
            perfil?.is_admin === true ||
            perfil?.tipo === 'admin' ||
            user.user_metadata?.is_admin === true ||
            user.user_metadata?.tipo === 'admin'
          )

          if (ehAdmin) {
            setEmail(user.email || '')
            setUsuarioSessaoAtiva(user)
          } else {
            // Conta de imobiliária, corretor ou proprietário NÃO É ADMIN!
            setUsuarioSessaoAtiva(null)
            setEmail('')
          }
        }
      } catch (err) {
        console.error('Erro ao verificar sessão Supabase:', err)
      } finally {
        setVerificandoSessao(false)
      }
    }
    checarSessao()
  }, [])

  async function handleLogoutTrocarConta() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setUsuarioSessaoAtiva(null)
      setEmail('')
      setSenha('')
      setChaveSecreta('')
      setErro(null)
    } catch (err) {
      console.error('Erro ao encerrar sessão para troca:', err)
    }
  }

  // ── LOGIN DIRETO: CREDENCIAIS + PIN MASTER ──
  async function handleLoginAdmin(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)

    try {
      // 1. Validação da Chave Secreta Master da Fixum
      const chaveLimpa = chaveSecreta.trim()
      if (chaveLimpa !== CHAVE_SECRETA_ADMIN_PADRAO) {
        setErro('Chave Secreta Master inválida. Acesso administrativo bloqueado.')
        setCarregando(false)
        return
      }

      const supabase = createClient()
      let userAutenticado = usuarioSessaoAtiva

      // 2. Se não houver sessão ativa confirmada como admin ou se preencheu email/senha
      if (!userAutenticado || (senha && senha.length > 0) || (email && email.trim() !== userAutenticado.email)) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        })

        if (authError || !authData.user) {
          setErro('Credenciais de administrador inválidas. Verifique o e-mail e a senha.')
          setCarregando(false)
          return
        }
        userAutenticado = authData.user
      }

      // 3. Verificação ESTRITA de privilégio no perfil (is_admin / tipo)
      const { data: perfil } = await supabase
        .from('perfis')
        .select('is_admin, tipo')
        .eq('id', userAutenticado.id)
        .maybeSingle()

      const ehAdmin = (
        userAutenticado.email === 'admin@fixum.com.br' ||
        perfil?.is_admin === true ||
        perfil?.tipo === 'admin' ||
        userAutenticado.user_metadata?.is_admin === true ||
        userAutenticado.user_metadata?.tipo === 'admin'
      )

      if (!ehAdmin) {
        setErro(`Acesso Negado: A conta "${userAutenticado.email}" não possui permissão de Administrador Master.`)
        setCarregando(false)
        return
      }

      // 4. Sucesso: Registrar sessão blindada e entrar direto no painel
      salvarSessaoAdmin(userAutenticado.email || email.trim())
      router.push('/admin')
    } catch (err: any) {
      setErro(err?.message || 'Falha ao autenticar administrador.')
      setCarregando(false)
    }
  }

  return (
    <div className={styles.paginaLogin}>
      <div className={styles.cardLogin}>
        <div className={styles.cabecalho}>
          <div className={styles.escudoIcone}>🛡️</div>
          <h1 className={styles.titulo}>Painel Executivo Fixum</h1>
          <p className={styles.subtitulo}>
            Acesso restrito para administradores autorizados
          </p>
        </div>

        {erro && (
          <div className={styles.alertaErro}>
            <span>⚠️</span>
            <span>{erro}</span>
          </div>
        )}

        {usuarioSessaoAtiva && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Conta Master Conectada
              </div>
              <div style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: 700, wordBreak: 'break-all' }}>
                {usuarioSessaoAtiva.email}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogoutTrocarConta}
              style={{
                background: '#334155',
                border: 'none',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '6px 10px',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.2s',
              }}
              title="Sair desta conta para entrar com outras credenciais"
            >
              Trocar Conta
            </button>
          </div>
        )}

        <form onSubmit={handleLoginAdmin} className={styles.formulario}>
          {!usuarioSessaoAtiva && (
            <>
              <div className={styles.grupoInput}>
                <label htmlFor="admin-email" className={styles.label}>E-mail de Administrador</label>
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
                <label htmlFor="admin-password" className={styles.label}>Senha Mestra</label>
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
            </>
          )}

          <div className={styles.grupoInput}>
            <label htmlFor="admin-pin-master" className={styles.label}>
              <span>Chave Secreta Master / PIN</span>
              <span style={{ fontSize: '0.75rem', color: '#f87171' }}>Obrigatório</span>
            </label>
            <InputSenha
              id="admin-pin-master"
              name="pin-master-security-token"
              value={chaveSecreta}
              onChange={(e) => setChaveSecreta(e.target.value)}
              placeholder="Chave de segurança master"
              className={`${styles.input} ${styles.inputPin}`}
              estiloDark={true}
              autoComplete="one-time-code"
              data-lpignore="true"
              data-1p-ignore="true"
              required
            />
          </div>

          <button
            type="submit"
            className={styles.btnEntrar}
            disabled={carregando || verificandoSessao}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className={styles.rodape}>
          <Link href="/" className={styles.linkVoltar}>
            ← Voltar ao site principal
          </Link>
        </div>
      </div>
    </div>
  )
}
