import { NextResponse } from 'next/server'
import { enviarCodigoOtpEmail } from '@/lib/email'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirUsuario, exigirAdmin } from '@/lib/auth/servidor'
import { listarTodosUsuarios } from '@/lib/auth/contexto-conta'
import { gerarCodigoOtp, verificarOtpPendente, verificarOtpUsuario, VALIDADE_OTP_MS } from '@/lib/otp'

// Motivos que alteram a segurança da própria conta exigem estar logado com o mesmo e-mail
const MOTIVOS_DA_PROPRIA_CONTA = ['ativar_2fa', 'desativar_2fa']

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { acao, email, codigo, motivo } = body

    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 })
    }

    const emailLimpo = email.trim().toLowerCase()
    const supabase = criarClienteAdmin()

    // Ações sobre a própria conta: o e-mail precisa ser o da sessão
    if (acao === 'desativar_2fa' || MOTIVOS_DA_PROPRIA_CONTA.includes(motivo)) {
      const auth = await exigirUsuario(req)
      if (!auth.ok) return auth.resposta
      if ((auth.usuario.email || '').toLowerCase() !== emailLimpo) {
        return NextResponse.json({ error: 'O e-mail informado não corresponde à sua conta.' }, { status: 403 })
      }
    }

    // Envio de código para cadastrar operador administrativo: somente administradores
    if (motivo === 'criar_operador') {
      const admin = await exigirAdmin(req)
      if (!admin.ok) return admin.resposta
    }

    // 1. Localizar usuário no Supabase Auth
    const usuarios = await listarTodosUsuarios(supabase)
    const usuario = usuarios.find((u) => (u.email || '').toLowerCase() === emailLimpo)

    // ── AÇÃO 1: ENVIAR CÓDIGO OTP POR E-MAIL ──
    if (acao === 'enviar') {
      // ── VALIDAÇÃO PRÉVIA: Impedir envio de código se a conta já existir ──
      if (motivo === 'cadastro') {
        if (emailLimpo === 'admin@fixum.com.br' || emailLimpo.endsWith('@fixum.com.br')) {
          return NextResponse.json({
            error: 'Este e-mail institucional é reservado para a administração da Fixum. Acesse /admin/login.',
          }, { status: 403 })
        }

        if (usuario) {
          return NextResponse.json({
            error: 'Este e-mail já está cadastrado na Fixum. Por favor, faça login, recupere sua senha ou informe outro e-mail válido.',
          }, { status: 409 })
        }
      }

      if (motivo === 'criar_operador') {
        if (usuario) {
          return NextResponse.json({
            error: `O e-mail "${emailLimpo}" já possui cadastro no sistema.`,
          }, { status: 409 })
        }
      }

      const codigoGerado = gerarCodigoOtp()
      const tempoExpiracao = Date.now() + VALIDADE_OTP_MS

      if (usuario) {
        // Guardar em app_metadata (o usuário não consegue ler nem alterar)
        await supabase.auth.admin.updateUserById(usuario.id, {
          app_metadata: {
            ...(usuario.app_metadata || {}),
            otp_code: codigoGerado,
            otp_expires: tempoExpiracao,
            otp_motivo: motivo || 'seguranca',
            otp_tentativas: 0,
          },
        })
      }

      // Registrar auditoria / pendência de verificação para rastreabilidade
      try {
        await supabase.from('logs_auditoria_admin').insert({
          admin_email: emailLimpo,
          tipo_acao: usuario ? 'ENVIO_OTP_EMAIL' : 'OTP_PENDENTE_NOVO_OPERADOR',
          entidade: usuario ? 'auth.users' : 'novo_operador',
          entidade_id: usuario ? usuario.id : null,
          dados_novos: usuario
            ? { expires_at: tempoExpiracao, motivo: motivo || 'seguranca' }
            : { codigo: codigoGerado, expires_at: tempoExpiracao, motivo: motivo || 'criar_operador', tentativas: 0 },
          justificativa: `Envio de código OTP para ${emailLimpo} (motivo: ${motivo || 'seguranca'})`,
          created_at: new Date().toISOString(),
        })
      } catch {}

      // Disparar e-mail real via Resend
      const envioEmail = await enviarCodigoOtpEmail({
        email: emailLimpo,
        codigo: codigoGerado,
        motivo,
        nome: usuario?.user_metadata?.nome,
      })

      if (!envioEmail.sucesso) {
        console.warn('Aviso de envio de e-mail (Resend):', envioEmail.error)
      }

      return NextResponse.json({
        sucesso: true,
        mensagem: `Código de verificação enviado com sucesso para ${emailLimpo}.`,
        enviadoPara: emailLimpo,
        emailEntregue: envioEmail.sucesso,
      })
    }

    // ── AÇÃO 2: VALIDAR CÓDIGO OTP ──
    if (acao === 'validar') {
      if (!codigo) {
        return NextResponse.json({ error: 'Código de verificação é obrigatório.' }, { status: 400 })
      }

      // Se o usuário já existe no Auth
      if (usuario) {
        const resultado = await verificarOtpUsuario(supabase, usuario, codigo, { consumir: true })
        if (!resultado.ok) {
          return NextResponse.json({ error: resultado.erro }, { status: 400 })
        }

        await supabase.auth.admin.updateUserById(usuario.id, {
          user_metadata: {
            ...(usuario.user_metadata || {}),
            two_factor_enabled: motivo === 'ativar_2fa' ? true : usuario.user_metadata?.two_factor_enabled,
            email_verificado_fixum: true,
          },
        })

        if (motivo === 'ativar_2fa') {
          try {
            await supabase.from('perfis').update({
              two_factor_enabled: true,
            }).eq('id', usuario.id)
          } catch {}
        }

        return NextResponse.json({ sucesso: true, mensagem: 'Código validado com sucesso!' })
      }

      // Se o usuário ainda NÃO existe (cadastro / novo operador). O código só é consumido
      // na criação da conta (/api/auth/cadastrar ou /api/admin/operadores), que valida de novo.
      const resultado = await verificarOtpPendente(supabase, emailLimpo, codigo, { consumir: false })
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.erro }, { status: 400 })
      }

      return NextResponse.json({ sucesso: true, mensagem: 'Código validado com sucesso!' })
    }

    // ── AÇÃO 3: DESATIVAR 2FA ──
    if (acao === 'desativar_2fa') {
      if (!usuario) {
        return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
      }

      const metaAtual = usuario.user_metadata || {}
      await supabase.auth.admin.updateUserById(usuario.id, {
        user_metadata: {
          ...metaAtual,
          two_factor_enabled: false,
        },
      })

      try {
        await supabase.from('perfis').update({
          two_factor_enabled: false,
        }).eq('id', usuario.id)
      } catch {}

      return NextResponse.json({ sucesso: true, mensagem: '2FA desativado com sucesso.' })
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar OTP' }, { status: 500 })
  }
}
