import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import PaginaImobiliariaCliente from './PaginaImobiliariaCliente'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!id) return { title: 'Imobiliária | Fixum' }

  try {
    const supabase = createSupabaseAdmin(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: perfil } = await supabase
      .from('perfis')
      .select('nome, foto_url')
      .eq('id', id)
      .maybeSingle()

    if (!perfil) return { title: 'Imobiliária não encontrada | Fixum' }

    return {
      title: `${perfil.nome} — Imóveis & Portfólio | Fixum`,
      description:
        `Confira os imóveis à venda e para alugar de ${perfil.nome} na plataforma Fixum.`,
      openGraph: {
        title: `${perfil.nome} | Fixum Imóveis`,
        description:
          `Encontre casas, apartamentos e salas comerciais de ${perfil.nome}.`,
        images: perfil.foto_url ? [{ url: perfil.foto_url }] : [],
      },
    }
  } catch {
    return { title: 'Imobiliária | Fixum' }
  }
}

export default async function PaginaImobiliaria({ params }: Props) {
  const { id } = await params
  if (!id) notFound()

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
    notFound()
  }

  // 2. Buscar corretores associados
  let idsAnunciantes = [id]
  let corretores: any[] = []
  try {
    const { data: allUsers } = await supabase.auth.admin.listUsers()
    const membros = (allUsers?.users || []).filter(
      (u) => u.user_metadata?.imobiliaria_id === id && u.id !== id
    )
    corretores = membros.map((u) => ({
      id: u.id,
      nome: u.user_metadata?.nome || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Corretor',
      email: u.email,
      telefone: u.user_metadata?.telefone || null,
      creci: u.user_metadata?.creci || null,
      foto_url: u.user_metadata?.foto_url || null,
    }))
    idsAnunciantes = Array.from(new Set([id, ...corretores.map((c) => c.id)]))
  } catch {}

  // 3. Buscar imóveis ativos da imobiliária
  let imoveis: any[] = []
  try {
    const { data: listaImoveis } = await supabase
      .from('imoveis')
      .select('*, fotos_imovel (id, url, principal, ordem)')
      .in('anunciante_id', idsAnunciantes)
      .in('status', ['ativo', 'publicado'])
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false })

    imoveis = listaImoveis || []
  } catch {}

  return (
    <PaginaImobiliariaCliente
      imobiliaria={perfil}
      corretores={corretores}
      imoveis={imoveis}
    />
  )
}
