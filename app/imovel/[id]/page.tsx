import { createClient } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import PaginaImovelCliente from './PaginaImovelCliente'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PaginaImovel({ params }: Props) {
  const { id } = await params
  const supabase = createClient()

  // Query principal - apenas fotos (FK garantida)
  const { data: imovel, error } = await supabase
    .from('imoveis')
    .select('*, fotos_imovel (id, url, principal, ordem)')
    .eq('id', id)
    .single()

  // Perfil do anunciante e Imobiliária - tolerante a erro
  const anuncianteId = imovel.anunciante_id || imovel.usuario_id
  let perfil: any = null
  let imobiliariaNome = ''

  if (anuncianteId) {
    const { data: p } = await supabase
      .from('perfis')
      .select('id, nome, tipo, foto_url, telefone, whatsapp, creci, email')
      .eq('id', anuncianteId)
      .maybeSingle()
    perfil = p

    // Se for corretor, descobrir a imobiliária dele
    if (p?.tipo === 'corretor') {
      const { data: userData } = await supabase.auth.admin.getUserById(anuncianteId).catch(() => ({ data: null }))
      const imobId = userData?.user?.user_metadata?.imobiliaria_id
      if (imobId) {
        const { data: imobPerfil } = await supabase.from('perfis').select('nome').eq('id', imobId).maybeSingle()
        if (imobPerfil?.nome) {
          imobiliariaNome = imobPerfil.nome
        }
      }
    } else if (p?.tipo === 'imobiliaria') {
      imobiliariaNome = p.nome
    }
  }

  // Caracteristicas - tolerante a erro
  const { data: caracteristicas } = await supabase
    .from('caracteristicas_imovel')
    .select('caracteristica')
    .eq('imovel_id', id)

  // Historico de precos - tolerante a erro
  const { data: historico } = await supabase
    .from('historico_precos')
    .select('*')
    .eq('imovel_id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  const imovelCompleto = {
    ...imovel,
    fotos_imovel: imovel.fotos_imovel ?? [],
    caracteristicas_imovel: caracteristicas ?? [],
    perfis: perfil ? { ...perfil, imobiliaria_nome: imobiliariaNome } : undefined,
  }

  return <PaginaImovelCliente imovel={imovelCompleto} historico={historico ?? []} />
}
