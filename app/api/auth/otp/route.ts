import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarCodigoOtpEmail } from '@/lib/email'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { acao, email, codigo, motivo } = body

    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 })
    }

    const emailLimpo = email.trim().toLowerCase()
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Localizar usuário no Supabase Auth
    const { data: authData, error: errList } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (errList) {
      return NextResponse.json({ error: 'Erro ao consultar usuários.' }, { status: 500 })
    }

    const usuario = authData.users.find((u) => (u.email || '').toLowerCase() === emailLimpo)

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

      // Gerar código de 6 dígitos numéricos
      const codigoGerado = Math.floor(100000 + Math.random() * 900000).toString()
      const tempoExpiracao = Date.now() + 10 * 60 * 1000 // 10 minutos de validade

      if (usuario) {
        // Salvar nos metadados do usuário existente
        const metaAtual = usuario.user_metadata || {}
        await supabase.auth.admin.updateUserById(usuario.id, {
          user_metadata: {
            ...metaAtual,
            otp_code: codigoGerado,
            otp_expires: tempoExpiracao,
            otp_motivo: motivo || 'seguranca',
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
          dados_novos: {
            codigo: codigoGerado,
            expires_at: tempoExpiracao,
            motivo: motivo || 'criar_operador',
          },
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
        // Retornamos preview para testes imediatos em desenvolvimento
        codigoPreview: codigoGerado,
      })
    }

    // ── AÇÃO 2: VALIDAR CÓDIGO OTP ──
    if (acao === 'validar') {
      if (!codigo) {
        return NextResponse.json({ error: 'Código de verificação é obrigatório.' }, { status: 400 })
      }

      const codigoLimpo = codigo.toString().replace(/\D/g, '')

      // Se o usuário já existe no Auth
      if (usuario) {
        const meta = usuario.user_metadata || {}

        if (!meta.otp_code || !meta.otp_expires) {
          return NextResponse.json({ error: 'Nenhum código ativo encontrado. Solicite um novo código.' }, { status: 400 })
        }

        if (Date.now() > meta.otp_expires) {
          return NextResponse.json({ error: 'O código de verificação expirou. Solicite um novo código.' }, { status: 400 })
        }

        if (meta.otp_code !== codigoLimpo) {
          return NextResponse.json({ error: 'Código de verificação incorreto. Verifique os números recebidos.' }, { status: 400 })
        }

        // Código válido: limpar código usado
        await supabase.auth.admin.updateUserById(usuario.id, {
          user_metadata: {
            ...meta,
            otp_code: null,
            otp_expires: null,
            two_factor_enabled: motivo === 'ativar_2fa' ? true : meta.two_factor_enabled,
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

      // Se o usuário ainda NÃO existe (novo operador sendo cadastrado)
      const { data: logsOtp } = await supabase
        .from('logs_auditoria_admin')
        .select('*')
        .eq('admin_email', emailLimpo)
        .eq('tipo_acao', 'OTP_PENDENTE_NOVO_OPERADOR')
        .order('created_at', { ascending: false })
        .limit(1)

      const ultimoOtp = logsOtp?.[0]
      if (!ultimoOtp || !ultimoOtp.dados_novos) {
        return NextResponse.json({ error: 'Nenhum código ativo encontrado para este e-mail. Solicite um novo código.' }, { status: 400 })
      }

      if (Date.now() > (ultimoOtp.dados_novos.expires_at || 0)) {
        return NextResponse.json({ error: 'O código de confirmação expirou. Solicite um novo código.' }, { status: 400 })
      }

      if (ultimoOtp.dados_novos.codigo !== codigoLimpo) {
        return NextResponse.json({ error: 'Código de verificação de 6 dígitos incorreto.' }, { status: 400 })
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
