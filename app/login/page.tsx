"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Logotipo } from "@/components/ui/Logo"
import FluxoEntrada from "@/components/auth/FluxoEntrada"
import styles from "./page.module.css"
import Icone from '@/components/ui/Icone'
import CurvasDeNivel from '@/components/ui/CurvasDeNivel'

function LoginConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const destinoBruto = searchParams.get('next') || '/painel'
  const destino = destinoBruto.startsWith('/') && !destinoBruto.startsWith('//') ? destinoBruto : '/painel'
  const etapaInicial = searchParams.get('etapa') === '2fa' ? '2fa' : 'email'
  const erroInicial = searchParams.get('erro') === 'login_social' ? 'Não foi possível entrar com o Google. Tente novamente.' : ''

  // Depois de autenticado: administradores seguem para o login do painel executivo
  async function aoConcluir() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: perfil } = await supabase.from('perfis').select('is_admin').eq('id', user.id).maybeSingle()
      if (perfil?.is_admin === true) {
        router.push('/admin/login')
        return
      }
    }
    router.push(destino)
  }

  return (
    <div className={styles.pagina}>
      {/* Lado Esquerdo: Formulário */}
      <div className={styles.lado}>
        <div className={styles.ladoConteudo}>
          {/* Topo com Logo e Voltar */}
          <div className={styles.topoForm}>
            <Link href="/" className={styles.logo}>
              <Logotipo largura={92} />
            </Link>
            <Link href="/" className={styles.linkVoltarHome}>
              <span>←</span> Voltar ao início
            </Link>
          </div>

          <div className={styles.cardForm}>
            <div className={styles.cabecalhoForm}>
              <h1>Bem-vindo de volta</h1>
              <p>Entre com o Google ou receba um código no seu e-mail — sem precisar de senha</p>
            </div>

            <FluxoEntrada aoConcluir={aoConcluir} destino={destino} etapaInicial={etapaInicial} erroInicial={erroInicial} />

            <div className={styles.rodape}>
              <span>Ainda não tem uma conta?</span>
              <Link href="/cadastro" className={styles.linkCadastro}>Criar conta gratuita</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Lado Direito: Painel Decorativo Visual (Estilo Pro) */}
      <div className={styles.ladoVisual}>
        <CurvasDeNivel className={styles.curvasLado} picos={[{ x: 0.7, y: 0.35, aneis: 18, passo: 34, semente: 11 }]} />

        <div className={styles.ladoVisualConteudo}>
          {/* Badge flutuante */}
          <div className={styles.badgeDestaque}>
            <span className={styles.pontoVerde} />
            <span>Fixum</span>
          </div>

          <h2>Seu próximo lugar começa <em>no mapa.</em></h2>
          <p>Entre para ver seus favoritos, acompanhar contatos e gerenciar seus anúncios.</p>

          {/* Card Mockup Flutuante com Efeito Glassmorphism */}
          <div className={styles.cardPreviewGlass}>
            <div className={styles.cardPreviewTopo}>
              <div className={styles.tagStatus}>Novo contato</div>
              <span className={styles.horarioLead}>Há 2 min</span>
            </div>
            <div className={styles.cardPreviewCorpo}>
              <div className={styles.avatarLead}><Icone nome="usuario" tamanho={16} /></div>
              <div>
                <div className={styles.nomeLead}>Rodrigo Silveira</div>
                <div className={styles.interesseLead}>Interesse: apartamento 3 quartos · Centro</div>
              </div>
            </div>
            <div className={styles.cardPreviewFooter}>
              <span className={styles.badgeConversao}>Veio pelo mapa</span>
              <span className={styles.valorPreco}>R$ 480.000</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--cor-texto-secundario)",
        fontSize: "var(--texto-sm)",
      }}>
        Carregando...
      </div>
    }>
      <LoginConteudo />
    </Suspense>
  )
}