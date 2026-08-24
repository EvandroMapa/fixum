import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PaginaImovelCliente from './PaginaImovelCliente'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

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

  if (anuncianteId) {
    try {
      const { data: p } = await supabase
        .from('perfis')
        .select('id, nome, tipo, foto_url, telefone, whatsapp, creci, email')
        .eq('id', anuncianteId)
        .maybeSingle()
      perfil = p

      // Se for corretor, descobrir a imobiliária dele e SEMPRE usar o branding dela
      if (p?.tipo === 'corretor') {
        try {
          if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const { data: userData } = await supabase.auth.admin.getUserById(anuncianteId)
            const imobId = userData?.user?.user_metadata?.imobiliaria_id
            if (imobId) {
              const { data: imobPerfil } = await supabase.from('perfis').select('id, nome, foto_url, telefone, whatsapp, creci, email').eq('id', imobId).maybeSingle()
              if (imobPerfil) {
                imobiliariaNome = imobPerfil.nome
                // Substituir TUDO pelo perfil da imobiliária mãe
                p.nome = imobPerfil.nome
                p.tipo = 'imobiliaria'
                p.foto_url = imobPerfil.foto_url || p.foto_url
                p.telefone = imobPerfil.telefone || p.telefone
                p.whatsapp = imobPerfil.whatsapp || p.whatsapp
                p.creci = imobPerfil.creci || p.creci
                p.email = imobPerfil.email || p.email
              }
            }
          }
        } catch {
          // Ignora se não conseguir ler metadata administrativa
        }
      } else if (p?.tipo === 'imobiliaria') {
        imobiliariaNome = p.nome
      }
    } catch {
      // Ignora erro no perfil
    }
  }

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
    perfis: perfil ? { ...perfil, imobiliaria_nome: imobiliariaNome } : undefined,
  }

  return <PaginaImovelCliente imovel={imovelCompleto} historico={historico ?? []} />
}

