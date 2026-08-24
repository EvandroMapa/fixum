import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PaginaImovelCliente from './PaginaImovelCliente'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params
    if (!id) return { title: 'Imóvel não encontrado • FIXUM' }

    const supabase = createSupabaseAdmin(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: imovel } = await supabase
      .from('imoveis')
      .select('*, fotos_imovel(url, principal)')
      .eq('id', id)
      .maybeSingle()

    if (!imovel) {
      return { title: 'Imóvel não encontrado • FIXUM' }
    }

    const cod = imovel.codigo ? ` (Cód: ${imovel.codigo})` : ''
    const precoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(imovel.preco || 0)
    const titulo = `${imovel.titulo || 'Imóvel'}${cod} • ${imovel.cidade || ''} | FIXUM`
    const descricao = `${imovel.negociacao === 'venda' ? 'Venda' : 'Aluguel'}: ${precoFormatado} • ${imovel.cidade || ''}${imovel.bairro ? ` - ${imovel.bairro}` : ''}. Veja fotos e localização no FIXUM.`
    const fotoCapa = imovel.fotos_imovel?.find((f: any) => f.principal)?.url || imovel.fotos_imovel?.[0]?.url || 'https://www.fixum.com.br/og-fixum.jpg'

    return {
      title: titulo,
      description: descricao,
      openGraph: {
        title: titulo,
        description: descricao,
        url: `https://www.fixum.com.br/imovel/${imovel.id}`,
        siteName: 'FIXUM Imóveis',
        images: [
          {
            url: fotoCapa,
            width: 1200,
            height: 630,
            alt: imovel.titulo || 'Imóvel FIXUM',
          },
        ],
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: titulo,
        description: descricao,
        images: [fotoCapa],
      },
    }
  } catch {
    return { title: 'Imóvel • FIXUM' }
  }
}

export default async function PaginaImovel({ params }: Props) {
  const { id } = await params
  if (!id) {
    notFound()
  }

  const supabase = createSupabaseAdmin(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Query principal - apenas fotos (FK garantida)
  const { data: imovel, error } = await supabase
    .from('imoveis')
    .select('*, fotos_imovel (id, url, principal, ordem)')
    .eq('id', id)
    .maybeSingle()

  if (!imovel || error) {
    notFound()
  }

  // Perfil do anunciante e Imobiliária - tolerante a erro
  const anuncianteId = imovel.anunciante_id || imovel.usuario_id
  let perfil: any = null
  let imobiliariaNome = ''
  let imobiliariaId = anuncianteId
  let idsAnunciantes: string[] = [anuncianteId]

  if (anuncianteId) {
    try {
      const { data: p } = await supabase
        .from('perfis')
        .select('id, nome, tipo, foto_url, telefone, whatsapp, creci, email')
        .eq('id', anuncianteId)
        .maybeSingle()
      perfil = p

      let imobIdParaBuscar: string | null = null

      if (p?.tipo === 'imobiliaria') {
        imobiliariaId = p.id
        imobiliariaNome = p.nome
        imobIdParaBuscar = p.id
      } else {
        // Verificar se é corretor ou usuário com imobiliária vinculada
        if (SERVICE_KEY) {
          try {
            const { data: userData } = await supabase.auth.admin.getUserById(anuncianteId)
            const meta = userData?.user?.user_metadata || {}
            const idImobVinculada = meta.imobiliaria_id
            if (idImobVinculada) {
              imobIdParaBuscar = idImobVinculada
              imobiliariaId = idImobVinculada
            }
          } catch {}
        }
      }

      // Se tiver uma imobiliária mãe, carregar o perfil oficial dela
      if (imobIdParaBuscar) {
        const { data: imobPerfil } = await supabase
          .from('perfis')
          .select('id, nome, foto_url, telefone, whatsapp, creci, email')
          .eq('id', imobIdParaBuscar)
          .maybeSingle()

        if (imobPerfil) {
          imobiliariaNome = imobPerfil.nome
          perfil = {
            ...(perfil || {}),
            ...imobPerfil,
            id: imobPerfil.id,
            nome: imobPerfil.nome,
            imobiliaria_nome: imobPerfil.nome,
            tipo: 'imobiliaria',
          }
        }
      }

      // Buscar todos os IDs de anunciantes vinculados a esta imobiliária
      if (imobiliariaId && SERVICE_KEY) {
        try {
          const { data: allUsers } = await supabase.auth.admin.listUsers()
          const corretoresDaImob = (allUsers?.users || []).filter(
            (u) => u.user_metadata?.imobiliaria_id === imobiliariaId
          )
          idsAnunciantes = Array.from(new Set([imobiliariaId, ...corretoresDaImob.map((c) => c.id)]))
        } catch {}
      }
    } catch {
      // Ignora erro no perfil
    }
  }

  // Fallback caso não tenha encontrado perfil no banco
  if (!perfil) {
    perfil = {
      id: anuncianteId,
      nome: 'Imobiliária Parceira',
      tipo: 'imobiliaria',
      imobiliaria_nome: 'Imobiliária Parceira',
    }
  }

  // Buscar outros imóveis da mesma imobiliária com a mesma negociação (venda ou aluguel)
  let outrosImoveis: any[] = []
  let totalImoveisImobiliaria = 1
  try {
    const { data: outros, count } = await supabase
      .from('imoveis')
      .select('*, fotos_imovel (id, url, principal, ordem)', { count: 'exact' })
      .in('anunciante_id', idsAnunciantes)
      .in('status', ['ativo', 'publicado'])
      .eq('negociacao', imovel.negociacao)
      .neq('id', id)
      .order('destaque', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6)

    outrosImoveis = (outros || []).map((o: any) => ({
      ...o,
      fotos: o.fotos_imovel ?? [],
    }))
    totalImoveisImobiliaria = (count || 0) + 1
  } catch {}

  // Caracteristicas - tolerante a erro
  let caracteristicas: any[] = []
  try {
    const { data: c } = await supabase
      .from('caracteristicas_imovel')
      .select('caracteristica')
      .eq('imovel_id', id)
    caracteristicas = c || []
  } catch {
    caracteristicas = []
  }

  // Historico de precos - tolerante a erro
  let historico: any[] = []
  try {
    const { data: h } = await supabase
      .from('historico_precos')
      .select('*')
      .eq('imovel_id', id)
      .order('created_at', { ascending: false })
      .limit(5)
    historico = h || []
  } catch {
    historico = []
  }

  const imovelCompleto = {
    ...imovel,
    fotos_imovel: imovel.fotos_imovel ?? [],
    caracteristicas_imovel: caracteristicas ?? [],
    perfis: perfil
      ? {
          ...perfil,
          imobiliaria_id: imobiliariaId,
          imobiliaria_nome: imobiliariaNome || perfil.nome,
          total_imoveis: totalImoveisImobiliaria,
        }
      : undefined,
  }

  return (
    <PaginaImovelCliente
      imovel={imovelCompleto}
      historico={historico ?? []}
      outrosImoveis={outrosImoveis}
    />
  )
}

