import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Renova a sessão do Supabase a cada requisição (padrão recomendado pelo @supabase/ssr).
 * Sem isso, o token do cookie pode expirar entre uma navegação e outra e as rotas /api
 * passam a responder 401 mesmo com o usuário "logado" no navegador.
 */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !chaveAnon) return resposta

  const supabase = createServerClient(url, chaveAnon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value))
        resposta = NextResponse.next({ request })
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options))
      },
    },
  })

  // Valida e, se preciso, renova o token (não remover: é o que mantém a sessão viva)
  await supabase.auth.getUser()

  return resposta
}

export const config = {
  // Ignora arquivos estáticos, imagens e o webhook de pagamentos (chamado pelo Asaas, sem sessão)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|api/pagamentos/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
}
