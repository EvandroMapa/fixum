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

  if (error || !imovel) {
    notFound()
  }

  // Perfil do anunciante - tolerante a erro
  const { data: perfil } = await supabase
    .from('perfis')
    .select('id, nome, tipo, foto_url, telefone, whatsapp')
    .eq('id', imovel.usuario_id)
    .maybeSingle()

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
    perfis: perfil ?? undefined,
  }

  return <PaginaImovelCliente imovel={imovelCompleto} historico={historico ?? []} />
}
