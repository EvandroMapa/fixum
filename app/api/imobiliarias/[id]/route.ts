import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID da imobiliária é obrigatório.' }, { status: 400 })
    }

    const supabase = createSupabaseAdmin(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Buscar perfil da imobiliária
    const { data: perfil, error: erroPerfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (erroPerfil || !perfil) {
      return NextResponse.json({ error: 'Imobiliária não encontrada.' }, { status: 404 })
    }

    // 2. Buscar corretores associados
    const { data: allUsers } = await supabase.auth.admin.listUsers()
    const corretores = (allUsers?.users || [])
      .filter((u) => u.user_metadata?.imobiliaria_id === id && u.id !== id)
      .map((u) => ({
        id: u.id,
        nome: u.user_metadata?.nome || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Corretor',
        email: u.email,
        telefone: u.user_metadata?.telefone || null,
        creci: u.user_metadata?.creci || null,
        foto_url: u.user_metadata?.foto_url || null,
        papel: u.user_metadata?.papel || 'corretor',
      }))

    const idsAnunciantes = [id, ...corretores.map((c) => c.id)]

    // 3. Buscar imóveis ativos da imobiliária e dos corretores
    const { data: imoveis, error: erroImoveis } = await supabase
      .from('imoveis')
      .select('*, fotos_imovel (id, url, principal, ordem)')
      .in('anunciante_id', idsAnunciantes)
      .in('status', ['ativo', 'publicado'])
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false })

    if (erroImoveis) {
      return NextResponse.json({ error: erroImoveis.message }, { status: 500 })
    }

    return NextResponse.json({
      imobiliaria: perfil,
      corretores,
      totalImoveis: imoveis?.length || 0,
      imoveis: imoveis || [],
      idsAnunciantes,
    })
  } catch (err: any) {
    console.error('Erro na API de imobiliária:', err)
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
  }
}
