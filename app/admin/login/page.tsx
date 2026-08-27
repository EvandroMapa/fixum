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
          setEmail(user.email || '')
          setUsuarioSessaoAtiva(user)
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

      // 2. Se não houver sessão ativa do Supabase ou se uma nova senha foi preenchida
      if (!userAutenticado || (senha && senha.length > 0)) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        })

        if (authError || !authData.user) {
          setErro('Credenciais de administrador inválidas.')
          setCarregando(false)
          return
        }
        userAutenticado = authData.user
      }

      // 3. Verificação de privilégio no perfil (is_admin / tipo_anunciante)
      const { data: perfil } = await supabase
        .from('perfis')
        .select('is_admin, tipo_anunciante')
        .eq('id', userAutenticado.id)
        .maybeSingle()

      const ehAdmin = perfil?.is_admin === true || perfil?.tipo_anunciante === 'admin' || userAutenticado.user_metadata?.tipo === 'admin' || userAutenticado.email === 'admin@fixum.com.br'

      // Se a flag is_admin existir e for explicitamente falsa sem ser admin de metadata
      if (perfil && perfil.is_admin === false && !ehAdmin) {
        setErro('Esta conta de usuário não possui permissão de Administrador Master.')
        setCarregando(false)
        return
      }

      // 4. Sucesso: Registrar sessão blindada
      salvarSessaoAdmin(userAutenticado.email || email)
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
          <p className={styles.subtitulo}>Acesso restrito para administradores autorizados</p>
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
              autoFocus={!!usuarioSessaoAtiva}
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className={styles.btnEntrar}
          >
            {carregando ? 'Autenticando...' : '🔒 Desbloquear Painel Admin'}
          </button>
        </form>

        <div className={styles.rodape}>
          <Link href="/" className={styles.linkVoltar}>
            ← Voltar para o portal Fixum
          </Link>
        </div>
      </div>
    </div>
  )
}

