import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { exigirAdmin } from '@/lib/auth/servidor'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { enviarCodigoOtpEmail } from '@/lib/email'
import { gerarCodigoOtp, limparCodigo, MAX_TENTATIVAS_OTP, VALIDADE_OTP_MS } from '@/lib/otp'
import { COOKIE_SELO_ADMIN, criarSelo, opcoesCookieSelo } from '@/lib/auth/selo-admin'

/**
 * Verificação em duas etapas do painel admin por e-mail.
 *   POST { acao: 'enviar' }                 → manda um código de 6 dígitos para o e-mail do admin
 *   POST { acao: 'confirmar', codigo }      → confere o código e grava o selo (cookie httpOnly assinado)
 *
 * Exige e-mail e senha já confirmados (sessão do Supabase) e perfis.is_admin = true.
 * O código não é guardado em texto: só o hash, junto da validade e das tentativas, em logs_auditoria_admin.
 */

const TIPO_LOG = 'OTP_LOGIN_ADMIN'
const INTERVALO_REENVIO_MS = 60 * 1000

function hashCodigo(usuarioId: string, codigo: string) {
  return createHash('sha256').update(`${usuarioId}:${codigo}`).digest('hex')
}

export async function POST(req: Request) {
  const auth = await exigirAdmin(req, { permitirCodigoPendente: true })
  if (!auth.ok) return auth.resposta

  const { acao, codigo } = await req.json().catch(() => ({}))
  const usuario = auth.usuario
  const email = (usuario.email || '').toLowerCase()
  const supabase = criarClienteAdmin()

  const { data: ultimos } = await supabase
    .from('logs_auditoria_admin')
    .select('id, dados_novos, created_at')
    .eq('admin_email', email)
    .eq('tipo_acao', TIPO_LOG)
    .order('created_at', { ascending: false })
    .limit(1)
  const ultimo = ultimos?.[0]

  // ── ENVIAR ──
  if (acao === 'enviar') {
    if (ultimo && Date.now() - new Date(ultimo.created_at).getTime() < INTERVALO_REENVIO_MS) {
      return NextResponse.json(
        { error: 'Aguarde um minuto para pedir um novo código.', codigo: 'aguarde' },
        { status: 429 }
      )
    }

    const novoCodigo = gerarCodigoOtp()
    await supabase.from('logs_auditoria_admin').insert({
      admin_email: email,
      tipo_acao: TIPO_LOG,
      entidade: 'login_admin',
      entidade_id: usuario.id,
      dados_novos: {
        hash: hashCodigo(usuario.id, novoCodigo),
        expires_at: Date.now() + VALIDADE_OTP_MS,
        tentativas: 0,
        consumido: false,
      },
      justificativa: `Código de acesso ao painel enviado para ${email}`,
      created_at: new Date().toISOString(),
    })

    const envio = await enviarCodigoOtpEmail({ email, codigo: novoCodigo, motivo: 'login_admin' })
    if (!envio.sucesso) {
      return NextResponse.json({ error: 'Não foi possível enviar o e-mail. Tente de novo em instantes.' }, { status: 502 })
    }
    return NextResponse.json({ enviado: true })
  }

  // ── CONFIRMAR ──
  if (acao === 'confirmar') {
    const dados = ultimo?.dados_novos
    if (!ultimo || !dados || dados.consumido) {
      return NextResponse.json({ error: 'Nenhum código ativo. Peça um novo código.' }, { status: 400 })
    }
    if (Date.now() > (dados.expires_at || 0)) {
      return NextResponse.json({ error: 'O código expirou. Peça um novo código.' }, { status: 400 })
    }
    if ((dados.tentativas || 0) >= MAX_TENTATIVAS_OTP) {
      return NextResponse.json({ error: 'Muitas tentativas incorretas. Peça um novo código.' }, { status: 400 })
    }

    if (dados.hash !== hashCodigo(usuario.id, limparCodigo(codigo))) {
      await supabase
        .from('logs_auditoria_admin')
        .update({ dados_novos: { ...dados, tentativas: (dados.tentativas || 0) + 1 } })
        .eq('id', ultimo.id)
      return NextResponse.json({ error: 'Código incorreto.' }, { status: 400 })
    }

    await supabase
      .from('logs_auditoria_admin')
      .update({ dados_novos: { ...dados, consumido: true, confirmado_em: new Date().toISOString() } })
      .eq('id', ultimo.id)

    const selo = criarSelo(usuario.id)
    const resposta = NextResponse.json({ confirmado: true })
    resposta.cookies.set(COOKIE_SELO_ADMIN, selo.valor, opcoesCookieSelo(selo.expiraEm))
    return resposta
  }

  return NextResponse.json({ error: 'Ação não suportada.' }, { status: 400 })
}
