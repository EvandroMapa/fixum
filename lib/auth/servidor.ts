import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { COOKIE_SELO_ADMIN, seloValido } from '@/lib/auth/selo-admin'

/**
 * Autenticação das rotas /api no servidor.
 * A identidade do usuário vem SEMPRE da sessão (cookie do Supabase ou header Authorization: Bearer),
 * nunca de um usuario_id enviado no corpo/query da requisição.
 *
 * Verificação em duas etapas:
 * - Clientes: app autenticador (TOTP) opcional; quem ativou só é aceito com a sessão em "aal2".
 * - Administradores: código por e-mail obrigatório (selo assinado em cookie, ver selo-admin.ts).
 */

type ResultadoAuth<T> = ({ ok: true } & T) | { ok: false; resposta: NextResponse }

export type NivelSessao = 'aal1' | 'aal2'

interface Autenticacao {
  usuario: User
  /** Nível de garantia da sessão atual: aal2 = passou pelo app autenticador */
  nivel: NivelSessao
  /** O usuário tem app autenticador cadastrado e verificado */
  temMfa: boolean
}

function lerNivelDoToken(token: string | null | undefined): NivelSessao {
  try {
    const payload = JSON.parse(Buffer.from((token || '').split('.')[1], 'base64url').toString('utf8'))
    return payload.aal === 'aal2' ? 'aal2' : 'aal1'
  } catch {
    return 'aal1'
  }
}

async function obterAutenticacao(req: Request): Promise<Autenticacao | null> {
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

  // getUser() valida o token no servidor do Supabase; só depois disso o conteúdo do token é confiável
  const { data, error } = tokenBearer
    ? await supabase.auth.getUser(tokenBearer)
    : await supabase.auth.getUser()
  if (error || !data?.user) return null

  const token = tokenBearer || (await supabase.auth.getSession()).data.session?.access_token
  const temMfa = (data.user.factors || []).some((f) => f.status === 'verified')

  return { usuario: data.user, nivel: lerNivelDoToken(token), temMfa }
}

export async function obterUsuarioDaRequisicao(req: Request): Promise<User | null> {
  const auth = await obterAutenticacao(req)
  return auth?.usuario ?? null
}

function negar(status: number, error: string, codigo: string): { ok: false; resposta: NextResponse } {
  return { ok: false, resposta: NextResponse.json({ error, codigo }, { status }) }
}

export async function exigirUsuario(req: Request): Promise<ResultadoAuth<{ usuario: User }>> {
  const auth = await obterAutenticacao(req)
  if (!auth) {
    return negar(401, 'Sessão inválida ou expirada. Faça login novamente.', 'sessao_invalida')
  }
  if (auth.temMfa && auth.nivel !== 'aal2') {
    return negar(401, 'Confirme o código do seu app autenticador para continuar.', 'mfa_pendente')
  }
  return { ok: true, usuario: auth.usuario }
}

/**
 * Exige sessão de um administrador. O privilégio é lido do banco (perfis.is_admin) com a service role —
 * nunca de user_metadata, que pode ser alterado pelo próprio usuário.
 * O código por e-mail é obrigatório: sem o selo da verificação (cookie assinado), o acesso é negado.
 * `permitirCodigoPendente` serve só para o login do admin (saber a etapa e enviar/confirmar o código).
 */
export async function exigirAdmin(
  req: Request,
  opcoes: { permitirCodigoPendente?: boolean } = {}
): Promise<ResultadoAuth<{ usuario: User; codigoConfirmado: boolean }>> {
  const auth = await obterAutenticacao(req)
  if (!auth) {
    return negar(401, 'Sessão inválida ou expirada. Faça login novamente.', 'sessao_invalida')
  }

  const supabase = criarClienteAdmin()
  const { data: perfil } = await supabase
    .from('perfis')
    .select('is_admin, status_conta')
    .eq('id', auth.usuario.id)
    .maybeSingle()

  const contaBloqueada = perfil?.status_conta && perfil.status_conta !== 'ativo'
  if (perfil?.is_admin !== true || contaBloqueada) {
    return negar(403, 'Acesso restrito a administradores.', 'nao_admin')
  }

  const codigoConfirmado = seloValido((await cookies()).get(COOKIE_SELO_ADMIN)?.value, auth.usuario.id)
  if (!codigoConfirmado && !opcoes.permitirCodigoPendente) {
    return negar(403, 'Confirme o código enviado ao seu e-mail para continuar.', 'codigo_pendente')
  }

  return { ok: true, usuario: auth.usuario, codigoConfirmado }
}
