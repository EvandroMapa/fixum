import { createClient } from '@/lib/supabase/client'
import { notFound } from 'next/navigation'
import PaginaImovelCliente from './PaginaImovelCliente'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PaginaImovel({ params }: Props) {
  const { id } = await params
  const supabase = createClient()

  const { data: imovel, error } = await supabase
    .from('imoveis')
    .select(`
      *,
      fotos_imovel (id, url, principal, ordem),
      caracteristicas_imovel (caracteristica),
      perfis (id, nome, tipo, foto_url, telefone, whatsapp)
    `)
    .eq('id', id)
    .single()

  if (error || !imovel) {
    notFound()
  }

  // Histórico de preços
  const { data: historico } = await supabase
    .from('historico_precos')
    .select('*')
    .eq('imovel_id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  return <PaginaImovelCliente imovel={imovel} historico={historico ?? []} />
}
