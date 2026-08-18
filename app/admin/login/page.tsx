'use client'

import { useState } from 'react'
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

      // 2. Autenticação via Supabase Auth (E-mail e Senha)
      const supabase = createClient()
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })

      if (authError || !authData.user) {
        setErro('Credenciais de administrador inválidas.')
        setCarregando(false)
        return
      }

      // 3. Verificação de privilégio no perfil (is_admin)
      const { data: perfil } = await supabase
        .from('perfis')
        .select('is_admin')
        .eq('id', authData.user.id)
        .single()

      // Se a flag is_admin existir e for falsa, bloqueia
      if (perfil && perfil.is_admin === false) {
        setErro('Esta conta de usuário não possui permissão de Administrador Master.')
        setCarregando(false)
        return
      }

      // 4. Sucesso: Registrar sessão blindada
      salvarSessaoAdmin(authData.user.email || email)
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

        <form onSubmit={handleLoginAdmin} className={styles.formulario}>
          <div className={styles.grupoInput}>
            <label className={styles.label}>E-mail de Administrador</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@fixum.com.br"
              className={styles.input}
              required
              autoFocus
            />
          </div>

          <div className={styles.grupoInput}>
            <label className={styles.label}>Senha Mestra</label>
            <InputSenha
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••••••"
              className={styles.input}
              estiloDark={true}
              required
            />
          </div>

          <div className={styles.grupoInput}>
            <label className={styles.label}>
              <span>Chave Secreta Master / PIN</span>
              <span style={{ fontSize: '0.75rem', color: '#f87171' }}>Obrigatório</span>
            </label>
            <InputSenha
              value={chaveSecreta}
              onChange={(e) => setChaveSecreta(e.target.value)}
              placeholder="Chave de segurança master"
              className={`${styles.input} ${styles.inputPin}`}
              estiloDark={true}
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className={styles.btnEntrar}
          >
            {carregando ? 'Autenticando...' : '🔒 Entrar no Painel Admin'}
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
