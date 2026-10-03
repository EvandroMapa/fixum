import { NextRequest, NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'
import { lerVinculo } from '@/lib/auth/contexto-conta'

const TIPOS_CONTA_PERMITIDOS = ['proprietario', 'corretor', 'imobiliaria']

// GET: Obter configurações da conta/imobiliária
export async function GET(req: NextRequest) {
  try {
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    // Por padrão lê a própria conta. Um corretor vinculado também pode ler as configurações da sua imobiliária.
    const { searchParams } = new URL(req.url)
    const usuarioSolicitado = searchParams.get('usuario_id') || auth.usuario.id
    const imobDoSolicitante = lerVinculo(auth.usuario).imobiliariaId
    if (usuarioSolicitado !== auth.usuario.id && usuarioSolicitado !== imobDoSolicitante) {
      return NextResponse.json({ error: 'Sem permissão para acessar estas configurações.' }, { status: 403 })
    }
    const usuarioId = usuarioSolicitado

    const supabase = criarClienteAdmin()

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(usuarioId)
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const meta = userData.user.user_metadata || {}

    // Buscar dados do perfil
    let perfilData: any = null
    try {
      const { data: p } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', usuarioId)
        .maybeSingle()
      perfilData = p
    } catch {}

    const imobId = lerVinculo(userData.user).imobiliariaId
    const isImobDirect = meta.tipo === 'imobiliaria' || meta.tipo_anunciante === 'imobiliaria' || perfilData?.tipo === 'imobiliaria'
    const isCorretorVinculado = !!(imobId && imobId !== usuarioId && !isImobDirect)

    let imobConfig: any = null
    if (isCorretorVinculado) {
      try {
        const { data: imobUser } = await supabase.auth.admin.getUserById(imobId)
        if (imobUser?.user) {
          imobConfig = imobUser.user.user_metadata || {}
        }
      } catch {}
    }

    const modoExibicaoPrecoFinal = isCorretorVinculado && imobConfig?.modo_exibicao_preco
      ? imobConfig.modo_exibicao_preco
      : meta.modo_exibicao_preco || perfilData?.modo_exibicao_preco || 'visivel'

    const prefixoFinal = isCorretorVinculado && imobConfig?.prefixo_codigo
      ? imobConfig.prefixo_codigo
      : meta.prefixo_codigo || perfilData?.prefixo_codigo || 'FX'

    const modoCodigoFinal = isCorretorVinculado && imobConfig?.tipo_codigo_imovel
      ? imobConfig.tipo_codigo_imovel
      : meta.tipo_codigo_imovel || perfilData?.tipo_codigo_imovel || 'automatico'

    const regraDistribuicaoFinal =
      (meta.regra_distribuicao_leads) ||
      (perfilData?.regra_distribuicao_leads) ||
      'captador'

    const whatsappDestinoFinal =
      (meta.whatsapp_destino) ||
      (perfilData?.whatsapp_destino) ||
      'corretor'

    return NextResponse.json({
      success: true,
      configs: {
        tipo: perfilData?.tipo || meta.tipo || 'proprietario',
        creci: perfilData?.creci || meta.creci || '',
        foto_url: perfilData?.foto_url || meta.foto_url || meta.avatar_url || '',
        modo_exibicao_preco: modoExibicaoPrecoFinal,
        prefixo_codigo: prefixoFinal,
        tipo_codigo_imovel: modoCodigoFinal,
        regra_distribuicao_leads: regraDistribuicaoFinal,
        whatsapp_destino: whatsappDestinoFinal,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno ao buscar configurações.' }, { status: 500 })
  }
}

// POST: Salvar configurações da conta/imobiliária
export async function POST(req: NextRequest) {
  try {
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta

    const body = await req.json()
    // A conta alterada é sempre a do usuário autenticado (usuario_id do corpo é ignorado)
    const usuario_id = auth.usuario.id
    const {
      tipo,
      creci,
      foto_url,
      modo_exibicao_preco,
      prefixo_codigo,
      tipo_codigo_imovel = 'automatico',
      regra_distribuicao_leads = 'captador',
      whatsapp_destino = 'corretor',
    } = body

    if (tipo !== undefined && tipo !== null && !TIPOS_CONTA_PERMITIDOS.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de conta inválido.' }, { status: 400 })
    }

    const supabase = criarClienteAdmin()

    // 1. Obter metadata atual do usuário
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(usuario_id)
    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const metaAtual = userData.user.user_metadata || {}
    const modoPrecoSalvar = modo_exibicao_preco !== undefined ? modo_exibicao_preco : (metaAtual.modo_exibicao_preco || 'visivel')

    // 2. Atualizar user_metadata no Auth
    const novoMeta = {
      ...metaAtual,
      tipo: tipo || metaAtual.tipo,
      tipo_anunciante: tipo || metaAtual.tipo_anunciante,
      creci: creci !== undefined ? creci : metaAtual.creci,
      foto_url: foto_url !== undefined ? foto_url : metaAtual.foto_url,
      avatar_url: foto_url !== undefined ? foto_url : metaAtual.avatar_url,
      modo_exibicao_preco: modoPrecoSalvar,
      prefixo_codigo: prefixo_codigo || metaAtual.prefixo_codigo,
      tipo_codigo_imovel: tipo_codigo_imovel || 'automatico',
      regra_distribuicao_leads: regra_distribuicao_leads || 'captador',
      whatsapp_destino: whatsapp_destino || 'corretor',
    }

    await supabase.auth.admin.updateUserById(usuario_id, {
      user_metadata: novoMeta,
    })

    // 3. Atualizar tabela perfis
    try {
      const dadosUpdatePerfil: Record<string, any> = {
        tipo: tipo || 'proprietario',
        creci: creci || null,
        foto_url: foto_url || null,
        modo_exibicao_preco: modoPrecoSalvar,
      }

      const { error: erroPerfil } = await supabase
        .from('perfis')
        .update(dadosUpdatePerfil)
        .eq('id', usuario_id)

      if (erroPerfil && erroPerfil.message?.includes('column')) {
        // Fallback caso a coluna ainda não exista na tabela perfis
        delete dadosUpdatePerfil.modo_exibicao_preco
        await supabase
          .from('perfis')
          .update(dadosUpdatePerfil)
          .eq('id', usuario_id)
      }
    } catch (errPerfil) {
      console.warn('Aviso ao atualizar perfis:', errPerfil)
    }

    return NextResponse.json({
      success: true,
      configs: {
        tipo: novoMeta.tipo,
        creci: novoMeta.creci,
        foto_url: novoMeta.foto_url,
        modo_exibicao_preco: novoMeta.modo_exibicao_preco,
        prefixo_codigo: novoMeta.prefixo_codigo,
        tipo_codigo_imovel: novoMeta.tipo_codigo_imovel,
        regra_distribuicao_leads: novoMeta.regra_distribuicao_leads,
        whatsapp_destino: novoMeta.whatsapp_destino,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno ao salvar configurações.' }, { status: 500 })
  }
}
