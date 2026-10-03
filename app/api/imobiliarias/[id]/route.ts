import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { listarMembrosEquipe, lerVinculo } from '@/lib/auth/contexto-conta'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID da imobiliária é obrigatório.' }, { status: 400 })
    }

    const supabase = criarClienteAdmin()

    // 1. Buscar perfil da imobiliária
    const { data: perfil, error: erroPerfil } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (erroPerfil || !perfil) {
      return NextResponse.json({ error: 'Imobiliária não encontrada.' }, { status: 404 })
    }

    const { data: donoData } = await supabase.auth.admin.getUserById(id)
    const donoMeta = donoData?.user?.user_metadata || {}
    const modoExibicaoPreco = perfil.modo_exibicao_preco || donoMeta.modo_exibicao_preco || 'visivel'

    const perfilFinal = {
      ...perfil,
      modo_exibicao_preco: modoExibicaoPreco,
    }

    // 2. Buscar corretores associados
    const corretores = (await listarMembrosEquipe(supabase, id))
      .map((u) => ({
        id: u.id,
        nome: u.user_metadata?.nome || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Corretor',
        email: u.email,
        telefone: u.user_metadata?.telefone || null,
        creci: u.user_metadata?.creci || null,
        foto_url: u.user_metadata?.foto_url || null,
        papel: lerVinculo(u).papel || 'corretor',
        modo_exibicao_preco: modoExibicaoPreco,
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

    const imoveisFormatados = (imoveis || []).map((im: any) => ({
      ...im,
      anunciante: perfilFinal,
    }))

    return NextResponse.json({
      imobiliaria: perfilFinal,
      corretores,
      totalImoveis: imoveisFormatados.length,
      imoveis: imoveisFormatados,
      idsAnunciantes,
    })
  } catch (err: any) {
    console.error('Erro na API de imobiliária:', err)
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 })
  }
}
