import { createClient as criarClienteSupabase } from '@supabase/supabase-js'

let realtimeClient: ReturnType<typeof criarClienteSupabase> | null = null

/**
 * Cliente Supabase dedicado exclusivamente ao Realtime (WebSocket).
 * Usa @supabase/supabase-js diretamente em vez do @supabase/ssr,
 * pois o createBrowserClient do SSR pode interferir no WebSocket.
 */
export function getRealtimeClient() {
  if (typeof window === 'undefined') {
    throw new Error('getRealtimeClient só pode ser chamado no navegador')
  }

  if (realtimeClient) return realtimeClient

  realtimeClient = criarClienteSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  )

  return realtimeClient
}
