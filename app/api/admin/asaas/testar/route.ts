import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirAdmin } from '@/lib/auth/servidor'

export async function POST(req: Request) {
  try {
    const auth = await exigirAdmin(req)
    if (!auth.ok) return auth.resposta

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
    const supabase = criarClienteAdmin()

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
