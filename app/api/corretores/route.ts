import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

// GET: Listar corretores vinculados à imobiliária
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const imobiliariaId = searchParams.get('imobiliaria_id')

    if (!imobiliariaId) {
      return NextResponse.json({ error: 'imobiliaria_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const corretores = (usersData.users || [])
      .filter((u) => u.user_metadata?.imobiliaria_id === imobiliariaId)
      .map((u) => ({
        id: u.id,
        nome: u.user_metadata?.nome || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Corretor',
        email: u.email || '',
        telefone: u.user_metadata?.telefone || '',
        creci: u.user_metadata?.creci || 'Não informado',
        created_at: u.created_at,
      }))

    // Contagem de imóveis por corretor
    if (corretores.length > 0) {
      const ids = corretores.map((c) => c.id)
      const { data: imoveis } = await supabase
        .from('imoveis')
        .select('anunciante_id')
        .in('anunciante_id', ids)

      const contagem: Record<string, number> = {}
      ;(imoveis || []).forEach((im: any) => {
        contagem[im.anunciante_id] = (contagem[im.anunciante_id] || 0) + 1
      })

      const formatados = corretores.map((c) => ({
        ...c,
        total_imoveis: contagem[c.id] || 0,
      }))

      return NextResponse.json({ corretores: formatados })
    }

    return NextResponse.json({ corretores: [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao buscar corretores.' }, { status: 500 })
  }
}

// DELETE / PATCH: Desvincular corretor
export async function POST(req: Request) {
  try {
    const { corretor_id } = await req.json()
    if (!corretor_id) {
      return NextResponse.json({ error: 'corretor_id é obrigatório.' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: getError } = await supabase.auth.admin.getUserById(corretor_id)
    if (getError || !userData.user) {
      return NextResponse.json({ error: 'Corretor não encontrado.' }, { status: 404 })
    }

    // Remover imobiliaria_id do user_metadata
    const updatedMeta = { ...userData.user.user_metadata, imobiliaria_id: null }
    await supabase.auth.admin.updateUserById(corretor_id, {
      user_metadata: updatedMeta,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao desvincular corretor.' }, { status: 500 })
  }
}
