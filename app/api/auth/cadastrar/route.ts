import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { verificarOtpPendente } from '@/lib/otp'

const TIPOS_CADASTRO = ['proprietario', 'corretor', 'imobiliaria']

export async function POST(req: Request) {
  try {
    const { email, password, nome, tipo, telefone, imobiliaria_id, creci, codigo } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 })
    }

    const emailLimpo = email.trim().toLowerCase()

    // ── PROTEÇÃO INSTITUCIONAL: Impedir cadastro de e-mails administrativos como clientes no portal ──
    if (emailLimpo === 'admin@fixum.com.br' || emailLimpo.endsWith('@fixum.com.br')) {
      return NextResponse.json({
        error: 'Este e-mail institucional é exclusivo da administração da Fixum. Para acessar o sistema executivo, utilize a rota /admin/login.',
      }, { status: 403 })
    }

    if (tipo && !TIPOS_CADASTRO.includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de conta inválido.' }, { status: 400 })
    }

    const supabase = criarClienteAdmin()

    // A conta é criada já confirmada, então a posse do e-mail precisa ser provada aqui com o código OTP
    const otp = await verificarOtpPendente(supabase, emailLimpo, codigo, { consumir: true })
    if (!otp.ok) {
      return NextResponse.json({ error: otp.erro }, { status: 400 })
    }

    // Convite de imobiliária: o vínculo só é aceito se o ID for de uma imobiliária real
    let imobiliariaConvite: string | null = null
    if (imobiliaria_id) {
      // Conta de imobiliária: perfis.tipo ou o tipo declarado no cadastro (há contas com os dois divergentes)
      const { data: imobPerfil } = await supabase.from('perfis').select('tipo').eq('id', imobiliaria_id).maybeSingle()
      const { data: imobAuth } = await supabase.auth.admin.getUserById(imobiliaria_id)
      const metaImob = imobAuth?.user?.user_metadata || {}
      const ehImobiliaria =
        imobPerfil?.tipo === 'imobiliaria' || metaImob.tipo === 'imobiliaria' || metaImob.tipo_anunciante === 'imobiliaria'
      if (!imobAuth?.user || !ehImobiliaria) {
        return NextResponse.json({ error: 'Convite de imobiliária inválido.' }, { status: 400 })
      }
      imobiliariaConvite = imobAuth.user.id
    }

    // Criar o usuário diretamente com email_confirm: true para evitar o rate limit de SMTP do Supabase
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome: nome || email.split('@')[0],
        tipo: tipo || 'proprietario',
        tipo_anunciante: tipo || 'proprietario',
        telefone: telefone || null,
        imobiliaria_id: imobiliariaConvite,
        creci: creci || null,
      },
      // Vínculo e papel ficam em app_metadata (somente o servidor altera); user_metadata é só espelho para a UI
      app_metadata: imobiliariaConvite ? { imobiliaria_id: imobiliariaConvite, papel: 'corretor' } : {},
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Criar/atualizar perfil na tabela perfis
    if (authUser?.user) {
      await supabase.from('perfis').upsert({
        id: authUser.user.id,
        nome: nome || email.split('@')[0],
        email,
        tipo: tipo || 'proprietario',
        telefone: telefone || null,
        creci: creci || null,
      })
    }

    return NextResponse.json({ success: true, user: authUser.user })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar cadastro.' }, { status: 500 })
  }
}
