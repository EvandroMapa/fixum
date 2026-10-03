import { NextResponse } from 'next/server'
import { exigirAdmin, pinAdminValido, respostaPinInvalido } from '@/lib/auth/servidor'

// GET: confirma no servidor se a sessão atual pertence a um administrador
export async function GET(req: Request) {
  const auth = await exigirAdmin(req)
  if (!auth.ok) return auth.resposta

  return NextResponse.json({ admin: true, email: auth.usuario.email })
}

// POST: confere o PIN Master (login no painel e desbloqueio da tela por inatividade)
export async function POST(req: Request) {
  const auth = await exigirAdmin(req)
  if (!auth.ok) return auth.resposta

  const { pin } = await req.json().catch(() => ({ pin: null }))
  if (!pinAdminValido(pin)) {
    return respostaPinInvalido('Chave Secreta Master inválida. Acesso administrativo bloqueado.')
  }

  return NextResponse.json({ admin: true, email: auth.usuario.email })
}
