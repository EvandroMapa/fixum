import { NextResponse } from 'next/server'
import { exigirAdmin } from '@/lib/auth/servidor'
import { COOKIE_SELO_ADMIN } from '@/lib/auth/selo-admin'

/**
 * GET: confirma no servidor se a sessão atual é de um administrador e em que etapa do login ela está:
 *   etapa 'codigo_email' → e-mail e senha ok, falta o código enviado por e-mail
 *   etapa 'liberado'     → código confirmado (selo válido), acesso total ao painel
 */
export async function GET(req: Request) {
  const auth = await exigirAdmin(req, { permitirCodigoPendente: true })
  if (!auth.ok) return auth.resposta

  const etapa = auth.codigoConfirmado ? 'liberado' : 'codigo_email'
  return NextResponse.json({ admin: true, email: auth.usuario.email, etapa })
}

/** DELETE: ao sair do painel, apaga o selo da verificação por e-mail. */
export async function DELETE() {
  const resposta = NextResponse.json({ ok: true })
  resposta.cookies.delete(COOKIE_SELO_ADMIN)
  return resposta
}
