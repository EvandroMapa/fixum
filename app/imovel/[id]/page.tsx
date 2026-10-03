import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import PaginaImovelCliente from './PaginaImovelCliente'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { lerVinculo, listarMembrosEquipe } from '@/lib/auth/contexto-conta'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params
    if (!id) return { title: 'Imóvel não encontrado • Fixum' }

    const supabase = criarClienteAdmin()

    const { data: imovel } = await supabase
      .from('imoveis')
      .select('*, fotos_imovel(url, principal)')
      .eq('id', id)
      .maybeSingle()

    if (!imovel) {
      return { title: 'Imóvel não encontrado • Fixum' }
    }

    const cod = imovel.codigo ? ` (Cód: ${imovel.codigo})` : ''
    const precoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(imovel.preco || 0)
    const titulo = `${imovel.titulo || 'Imóvel'}${cod} • ${imovel.cidade || ''} | Fixum`
    const descricao = `${imovel.negociacao === 'venda' ? 'Venda' : 'Aluguel'}: ${precoFormatado} • ${imovel.cidade || ''}${imovel.bairro ? ` - ${imovel.bairro}` : ''}. Veja fotos e localização no Fixum.`
    const fotoCapa = imovel.fotos_imovel?.find((f: any) => f.principal)?.url || imovel.fotos_imovel?.[0]?.url || 'https://www.fixum.com.br/og-fixum.jpg'

    return {
      title: titulo,
      description: descricao,
      openGraph: {
        title: titulo,
        description: descricao,
        url: `https://www.fixum.com.br/imovel/${imovel.id}`,
        siteName: 'Fixum',
        images: [
          {
            url: fotoCapa,
            width: 1200,
            height: 630,
            alt: imovel.titulo || 'Imóvel Fixum',
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
    return { title: 'Imóvel • Fixum' }
  }
}

export default async function PaginaImovel({ params }: Props) {
  const { id } = await params
  if (!id) {
    notFound()
  }

  const supabase = criarClienteAdmin()

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

      let modoExibicaoPrecoFinal: 'visivel' | 'sob_consulta' | 'por_anuncio' = 'visivel'
      let imobIdParaBuscar: string | null = null

      try {
        const { data: userData } = await supabase.auth.admin.getUserById(anuncianteId)
        const meta = userData?.user?.user_metadata || {}
        if (meta.modo_exibicao_preco) modoExibicaoPrecoFinal = meta.modo_exibicao_preco
        const idImobVinculada = userData?.user ? lerVinculo(userData.user).imobiliariaId : null
        if (idImobVinculada) {
          imobIdParaBuscar = idImobVinculada
          imobiliariaId = idImobVinculada
        }
      } catch {}

      if (p?.tipo === 'imobiliaria') {
        imobiliariaId = p.id
        imobiliariaNome = p.nome
        imobIdParaBuscar = p.id
      }

      // Se tiver uma imobiliária mãe, carregar o perfil oficial dela e suas preferências de preço
      if (imobIdParaBuscar) {
        const { data: imobPerfil } = await supabase
          .from('perfis')
          .select('id, nome, foto_url, telefone, whatsapp, creci, email')
          .eq('id', imobIdParaBuscar)
          .maybeSingle()

        if (imobIdParaBuscar !== anuncianteId) {
          try {
            const { data: imobUser } = await supabase.auth.admin.getUserById(imobIdParaBuscar)
            const imobMeta = imobUser?.user?.user_metadata || {}
            if (imobMeta.modo_exibicao_preco) {
              modoExibicaoPrecoFinal = imobMeta.modo_exibicao_preco
            }
          } catch {}
        }

        if (imobPerfil) {
          imobiliariaNome = imobPerfil.nome
          perfil = {
            ...(perfil || {}),
            ...imobPerfil,
            id: imobPerfil.id,
            nome: imobPerfil.nome,
            imobiliaria_nome: imobPerfil.nome,
            tipo: 'imobiliaria',
            modo_exibicao_preco: modoExibicaoPrecoFinal,
          }
        }
      }

      if (perfil) {
        perfil.modo_exibicao_preco = modoExibicaoPrecoFinal
      }

      // Buscar todos os IDs de anunciantes vinculados a esta imobiliária
      if (imobiliariaId) {
        try {
          const corretoresDaImob = await listarMembrosEquipe(supabase, imobiliariaId)
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
      nome: 'Imobiliária parceira',
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
      anunciante: perfil,
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

