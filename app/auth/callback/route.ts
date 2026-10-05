import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * Retorno do login social (Google). Troca o código do OAuth pela sessão no servidor e decide o destino:
 * - conta com verificação em duas etapas → /login?etapa=2fa (pede o código do app autenticador)
 * - conta nova, sem perfil completo → /completar-perfil
 * - demais → destino solicitado (?next=), restrito a caminhos internos do site
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const codigo = searchParams.get('code')
  const destinoBruto = searchParams.get('next') || '/painel'
  // Evita redirecionamento para sites externos (ex.: ?next=//site-malicioso.com)
  const destino = destinoBruto.startsWith('/') && !destinoBruto.startsWith('//') ? destinoBruto : '/painel'

  if (!codigo) {
    return NextResponse.redirect(`${origin}/login?erro=login_social`)
  }

  const lojaCookies = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => lojaCookies.getAll(),
      setAll: (lista) => lista.forEach(({ name, value, options }) => lojaCookies.set(name, value, options)),
    },
  })

  const { data, error } = await supabase.auth.exchangeCodeForSession(codigo)
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?erro=login_social`)
  }

  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (nivel?.nextLevel === 'aal2' && nivel.currentLevel !== 'aal2') {
    return NextResponse.redirect(`${origin}/login?etapa=2fa&next=${encodeURIComponent(destino)}`)
  }

  const { data: perfil } = await supabase.from('perfis').select('tipo').eq('id', data.user.id).maybeSingle()
  if (!perfil?.tipo) {
    return NextResponse.redirect(`${origin}/completar-perfil?next=${encodeURIComponent(destino)}`)
  }

  return NextResponse.redirect(`${origin}${destino}`)
}
