import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { timingSafeEqual } from 'crypto'
import type { User } from '@supabase/supabase-js'
import { criarClienteAdmin } from '@/lib/supabase/admin'

/**
 * Autenticação das rotas /api no servidor.
 * A identidade do usuário vem SEMPRE da sessão (cookie do Supabase ou header Authorization: Bearer),
 * nunca de um usuario_id enviado no corpo/query da requisição.
 */

type ResultadoAuth<T> = ({ ok: true } & T) | { ok: false; resposta: NextResponse }

export async function obterUsuarioDaRequisicao(req: Request): Promise<User | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !chaveAnon) return null

  const lojaCookies = await cookies()
  const supabase = createServerClient(url, chaveAnon, {
    cookies: {
      getAll: () => lojaCookies.getAll(),
      setAll: (lista) => {
        // Repassa ao navegador o token renovado (se o Supabase precisar fazer refresh)
        try {
          lista.forEach(({ name, value, options }) => lojaCookies.set(name, value, options))
        } catch {}
      },
    },
  })

  const header = req.headers.get('authorization') || ''
  const tokenBearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null

  const { data, error } = tokenBearer
    ? await supabase.auth.getUser(tokenBearer)
    : await supabase.auth.getUser()

  if (error || !data?.user) return null
  return data.user
}

export async function exigirUsuario(req: Request): Promise<ResultadoAuth<{ usuario: User }>> {
  const usuario = await obterUsuarioDaRequisicao(req)
  if (!usuario) {
    return {
      ok: false,
      resposta: NextResponse.json({ error: 'Sessão inválida ou expirada. Faça login novamente.' }, { status: 401 }),
    }
  }
  return { ok: true, usuario }
}

/**
 * Exige sessão de um administrador. O privilégio é lido do banco (perfis.is_admin) com a service role —
 * nunca de user_metadata, que pode ser alterado pelo próprio usuário.
 */
export async function exigirAdmin(req: Request): Promise<ResultadoAuth<{ usuario: User }>> {
  const auth = await exigirUsuario(req)
  if (!auth.ok) return auth

  const supabase = criarClienteAdmin()
  const { data: perfil } = await supabase
    .from('perfis')
    .select('is_admin, status_conta')
    .eq('id', auth.usuario.id)
    .maybeSingle()

  const contaBloqueada = perfil?.status_conta && perfil.status_conta !== 'ativo'
  if (perfil?.is_admin !== true || contaBloqueada) {
    return {
      ok: false,
      resposta: NextResponse.json({ error: 'Acesso restrito a administradores.' }, { status: 403 }),
    }
  }

  return auth
}

/**
 * Confere o PIN Master do painel administrativo. O PIN fica apenas no servidor (ADMIN_PIN, sem NEXT_PUBLIC_).
 * Se a variável não estiver configurada, nenhum PIN é aceito.
 */
export function pinAdminValido(pin: unknown): boolean {
  const esperado = process.env.ADMIN_PIN
  if (!esperado || typeof pin !== 'string') return false

  const a = Buffer.from(pin.trim())
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function respostaPinInvalido(mensagem = 'Chave Secreta Master inválida. Ação bloqueada.') {
  const mensagemFinal = process.env.ADMIN_PIN
    ? mensagem
    : 'ADMIN_PIN não está configurado no servidor. Defina a variável de ambiente para liberar ações administrativas.'
  return NextResponse.json({ error: mensagemFinal }, { status: 403 })
}
