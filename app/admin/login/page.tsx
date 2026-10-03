'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { salvarSessaoAdmin, verificarAdminNoServidor } from '@/lib/admin-auth'
import InputSenha from '@/components/ui/InputSenha'
import styles from './page.module.css'
import Icone from '@/components/ui/Icone'

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
          // Verificar NO SERVIDOR se o usuário autenticado É ADMINISTRADOR (perfis.is_admin)
          const { ok: ehAdmin } = await verificarAdminNoServidor()

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
      const chaveLimpa = chaveSecreta.trim()
      if (!chaveLimpa) {
        setErro('Informe a Chave Secreta Master.')
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

      // 3. Verificação NO SERVIDOR: privilégio de admin (perfis.is_admin) + Chave Secreta Master
      const verificacao = await verificarAdminNoServidor(chaveLimpa)
      if (!verificacao.ok) {
        setErro(verificacao.erro || `Acesso Negado: A conta "${userAutenticado.email}" não possui permissão de Administrador Master.`)
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
          <div className={styles.escudoIcone}><Icone nome="escudo" tamanho={16} /></div>
          <h1 className={styles.titulo}>Painel executivo Fixum</h1>
          <p className={styles.subtitulo}>
            Acesso restrito para administradores autorizados
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
                Conta Master conectada
              </div>
              <div style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: 700, wordBreak: 'break-all' }}>
                {usuarioSessaoAtiva.email}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogoutTrocarConta}
              style={{
                background: '#3F3B34',
                border: 'none',
                borderRadius: '8px',
                color: '#FAF7F1',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '6px 10px',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.2s',
              }}
              title="Sair desta conta para entrar com outras credenciais"
            >
              Trocar conta
            </button>
          </div>
        )}

        <form onSubmit={handleLoginAdmin} className={styles.formulario}>
          {!usuarioSessaoAtiva && (
            <>
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
                <label htmlFor="admin-password" className={styles.label}>Senha mestra</label>
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
              <span>Chave secreta Master / PIN</span>
              <span style={{ fontSize: '0.75rem', color: '#E8836B' }}>Obrigatório</span>
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
