import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com a service role (ignora RLS).
 * USO EXCLUSIVO NO SERVIDOR (rotas /api e Server Components). Nunca importe em componentes 'use client'.
 * As credenciais vêm apenas das variáveis de ambiente — não existe fallback no código.
 */
export function criarClienteAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !chaveServico) {
    throw new Error(
      'Supabase não configurado no servidor: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
    )
  }

  return createClient(url, chaveServico, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
