import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function POST(req: Request) {
  try {
    const { apiKey, modo } = await req.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'Chave de API do Asaas é obrigatória.' }, { status: 400 })
    }

    const isSandbox = modo === 'sandbox'
    const apiUrl = isSandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3'

    // Testar chamada na API do Asaas
    const res = await fetch(`${apiUrl}/customers?limit=1`, {
      method: 'GET',
      headers: {
        'access_token': apiKey.trim(),
        'Content-Type': 'application/json',
        'User-Agent': 'Fixum-Plataforma-Imobiliaria/1.0',
      },
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({
        sucesso: false,
        error: `Falha na autenticação do Asaas (${res.status}). Verifique se a chave de API está correta e autorizada no Asaas.`,
        detalhes: errText,
      }, { status: 400 })
    }

    // Salvar credencial atualizada no Supabase
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    await supabase.from('configuracoes_sistema').upsert([
      { chave: 'asaas_api_key', valor: apiKey.trim(), descricao: 'Chave de API do Asaas' },
      { chave: 'asaas_modo', valor: modo || 'producao', descricao: 'Ambiente do Asaas (producao/sandbox)' },
    ], { onConflict: 'chave' })

    return NextResponse.json({
      sucesso: true,
      mensagem: `Conexão com o Asaas estabelecida com sucesso em modo ${isSandbox ? 'Sandbox (Testes)' : 'Produção (Real)'}!`,
      modo: isSandbox ? 'sandbox' : 'producao',
    })
  } catch (err: any) {
    return NextResponse.json({ sucesso: false, error: err?.message || 'Erro ao testar conexão Asaas' }, { status: 500 })
  }
}
