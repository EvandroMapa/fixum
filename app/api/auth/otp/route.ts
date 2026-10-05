import { NextResponse } from 'next/server'
import { enviarCodigoOtpEmail } from '@/lib/email'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirAdmin } from '@/lib/auth/servidor'
import { listarTodosUsuarios } from '@/lib/auth/contexto-conta'
import { gerarCodigoOtp, verificarOtpPendente, VALIDADE_OTP_MS } from '@/lib/otp'

/**
 * Código de verificação para cadastrar um novo OPERADOR do painel administrativo
 * (confirma que o e-mail informado pelo admin existe e é do operador).
 *
 * Login, cadastro de clientes e recuperação de acesso usam o código nativo do Supabase Auth
 * (signInWithOtp / verifyOtp) — não esta rota.
 */
export async function POST(req: Request) {
  try {
    const admin = await exigirAdmin(req)
    if (!admin.ok) return admin.resposta

    const { acao, email, codigo, motivo } = await req.json()
    if (motivo !== 'criar_operador') {
      return NextResponse.json({ error: 'Motivo não suportado.' }, { status: 400 })
    }
    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 })
    }

    const emailLimpo = email.trim().toLowerCase()
    const supabase = criarClienteAdmin()

    // ── AÇÃO 1: ENVIAR CÓDIGO PARA O E-MAIL DO NOVO OPERADOR ──
    if (acao === 'enviar') {
      const usuarios = await listarTodosUsuarios(supabase)
      if (usuarios.some((u) => (u.email || '').toLowerCase() === emailLimpo)) {
        return NextResponse.json({ error: `O e-mail "${emailLimpo}" já possui cadastro no sistema.` }, { status: 409 })
      }

      const codigoGerado = gerarCodigoOtp()
      const tempoExpiracao = Date.now() + VALIDADE_OTP_MS

      await supabase.from('logs_auditoria_admin').insert({
        admin_email: emailLimpo,
        tipo_acao: 'OTP_PENDENTE_NOVO_OPERADOR',
        entidade: 'novo_operador',
        entidade_id: null,
        dados_novos: { codigo: codigoGerado, expires_at: tempoExpiracao, motivo: 'criar_operador', tentativas: 0 },
        justificativa: `Código de verificação enviado para ${emailLimpo} por ${admin.usuario.email} (novo operador)`,
        created_at: new Date().toISOString(),
      })

      const envioEmail = await enviarCodigoOtpEmail({ email: emailLimpo, codigo: codigoGerado, motivo })
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

    // ── AÇÃO 2: VALIDAR O CÓDIGO (o consumo definitivo acontece ao criar o operador) ──
    if (acao === 'validar') {
      if (!codigo) {
        return NextResponse.json({ error: 'Código de verificação é obrigatório.' }, { status: 400 })
      }
      const resultado = await verificarOtpPendente(supabase, emailLimpo, codigo, { consumir: false })
      if (!resultado.ok) {
        return NextResponse.json({ error: resultado.erro }, { status: 400 })
      }
      return NextResponse.json({ sucesso: true, mensagem: 'Código validado com sucesso!' })
    }

    return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao processar código' }, { status: 500 })
  }
}
