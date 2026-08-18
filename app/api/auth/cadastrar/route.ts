import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function POST(req: Request) {
  try {
    const { email, password, nome, tipo, telefone, imobiliaria_id, creci } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Criar o usuário diretamente com email_confirm: true para evitar o rate limit de SMTP do Supabase
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome: nome || email.split('@')[0],
        tipo: tipo || 'proprietario',
        tipo_anunciante: tipo || 'proprietario',
        telefone: telefone || null,
        imobiliaria_id: imobiliaria_id || null,
        creci: creci || null,
      },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Criar/atualizar perfil na tabela perfis
    if (authUser?.user) {
      await supabase.from('perfis').upsert({
        id: authUser.user.id,
        nome: nome || email.split('@')[0],
        email,
        tipo: tipo || 'proprietario',
        tipo_anunciante: tipo || 'proprietario',
        telefone: telefone || null,
        imobiliaria_id: imobiliaria_id || null,
        creci: creci || null,
        plano_id: tipo === 'imobiliaria' ? 'imobiliaria' : 'gratis',
      })
    }

    return NextResponse.json({ success: true, user: authUser.user })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar cadastro.' }, { status: 500 })
  }
}
