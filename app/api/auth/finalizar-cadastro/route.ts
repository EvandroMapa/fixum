import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario } from '@/lib/auth/servidor'
import { ehContaImobiliaria, lerVinculo } from '@/lib/auth/contexto-conta'

const TIPOS_CADASTRO = ['comprador', 'proprietario', 'corretor', 'imobiliaria']

/**
 * Conclui o cadastro depois que a pessoa confirmou o código do e-mail (a conta já existe e está logada).
 * Grava o perfil e, se veio por convite, vincula à imobiliária em app_metadata (só o servidor pode).
 * Nunca sobrescreve um perfil que já existia (ex.: alguém que já tinha conta usou a tela de cadastro).
 */
export async function POST(req: Request) {
  try {
    const auth = await exigirUsuario(req)
    if (!auth.ok) return auth.resposta
    const usuario = auth.usuario

    const { nome, tipo, telefone, creci, imobiliaria_id } = await req.json()
    if (!nome || !TIPOS_CADASTRO.includes(tipo)) {
      return NextResponse.json({ error: 'Nome e tipo de conta são obrigatórios.' }, { status: 400 })
    }

    const supabase = criarClienteAdmin()

    const { data: perfilExistente } = await supabase.from('perfis').select('id, tipo').eq('id', usuario.id).maybeSingle()
    if (perfilExistente?.tipo) {
      return NextResponse.json({ success: true, jaExistia: true })
    }

    // Convite de imobiliária: o vínculo só é aceito se o ID for de uma imobiliária real
    let imobiliariaConvite: string | null = null
    if (imobiliaria_id && !lerVinculo(usuario).imobiliariaId) {
      const { data: imobPerfil } = await supabase.from('perfis').select('tipo').eq('id', imobiliaria_id).maybeSingle()
      const { data: imobAuth } = await supabase.auth.admin.getUserById(imobiliaria_id)
      if (!imobAuth?.user || !ehContaImobiliaria(imobPerfil?.tipo, imobAuth.user.user_metadata || {})) {
        return NextResponse.json({ error: 'Convite de imobiliária inválido.' }, { status: 400 })
      }
      imobiliariaConvite = imobAuth.user.id
    }

    const tipoFinal = imobiliariaConvite ? 'corretor' : tipo

    await supabase.auth.admin.updateUserById(usuario.id, {
      user_metadata: {
        ...(usuario.user_metadata || {}),
        nome,
        tipo: tipoFinal,
        tipo_anunciante: tipoFinal,
        telefone: telefone || null,
        creci: creci || null,
        ...(imobiliariaConvite ? { imobiliaria_id: imobiliariaConvite, papel: 'corretor' } : {}),
      },
      // Vínculo e papel ficam em app_metadata (só o servidor altera); user_metadata é só espelho para a UI
      ...(imobiliariaConvite
        ? { app_metadata: { ...(usuario.app_metadata || {}), imobiliaria_id: imobiliariaConvite, papel: 'corretor' } }
        : {}),
    })

    const { error: erroPerfil } = await supabase.from('perfis').upsert({
      id: usuario.id,
      nome,
      email: usuario.email,
      tipo: tipoFinal,
      telefone: telefone || null,
      creci: creci || null,
    })
    if (erroPerfil) {
      return NextResponse.json({ error: 'Não foi possível salvar o perfil. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, jaExistia: false })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao concluir cadastro.' }, { status: 500 })
  }
}
