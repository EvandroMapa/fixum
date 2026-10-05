import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Selo da verificação em duas etapas do painel admin (código por e-mail).
 *
 * Depois que o administrador digita o código de 6 dígitos recebido por e-mail, o servidor grava
 * este selo num cookie httpOnly (o JavaScript da página não lê nem altera). Ele carrega o id do
 * usuário e a validade, assinados com um segredo que só o servidor conhece. Sem o selo válido,
 * exigirAdmin nega o acesso, mesmo com e-mail e senha corretos.
 */

export const COOKIE_SELO_ADMIN = 'fixum_admin_2fa'
export const VALIDADE_SELO_MS = 12 * 60 * 60 * 1000 // 12 horas

function segredo(): string {
  const valor = process.env.ADMIN_2FA_SEGREDO || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!valor) throw new Error('Defina ADMIN_2FA_SEGREDO (ou SUPABASE_SERVICE_ROLE_KEY) no ambiente.')
  return valor
}

function assinar(conteudo: string): string {
  return createHmac('sha256', segredo()).update(conteudo).digest('base64url')
}

export function criarSelo(usuarioId: string): { valor: string; expiraEm: Date } {
  const expira = Date.now() + VALIDADE_SELO_MS
  const conteudo = `${usuarioId}.${expira}`
  return { valor: `${conteudo}.${assinar(conteudo)}`, expiraEm: new Date(expira) }
}

export function seloValido(valor: string | undefined, usuarioId: string): boolean {
  if (!valor) return false
  const partes = valor.split('.')
  if (partes.length !== 3) return false
  const [id, expira, assinatura] = partes
  if (id !== usuarioId || !(Number(expira) > Date.now())) return false

  const esperada = Buffer.from(assinar(`${id}.${expira}`))
  const recebida = Buffer.from(assinatura)
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
}

/** Opções do cookie do selo (httpOnly, só HTTPS em produção, só no mesmo site). */
export function opcoesCookieSelo(expiraEm: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    expires: expiraEm,
  }
}
