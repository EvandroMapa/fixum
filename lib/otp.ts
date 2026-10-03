import type { SupabaseClient, User } from '@supabase/supabase-js'
import { randomInt } from 'crypto'

/**
 * Códigos OTP de 6 dígitos enviados por e-mail.
 * - Conta existente: código guardado em app_metadata (o usuário não consegue ler nem alterar).
 * - E-mail ainda sem conta (cadastro / novo operador): código guardado em logs_auditoria_admin.
 * Cada código aceita no máximo MAX_TENTATIVAS erros antes de exigir um novo envio.
 */

export const MAX_TENTATIVAS_OTP = 5
export const VALIDADE_OTP_MS = 10 * 60 * 1000

export type ResultadoOtp = { ok: true } | { ok: false; erro: string }

export function gerarCodigoOtp(): string {
  return randomInt(100000, 1000000).toString()
}

export function limparCodigo(codigo: unknown): string {
  return (codigo ?? '').toString().replace(/\D/g, '')
}

/** Valida (e opcionalmente consome) o OTP de um usuário que já existe no Auth. */
export async function verificarOtpUsuario(
  supabase: SupabaseClient,
  usuario: User,
  codigo: unknown,
  opcoes: { consumir: boolean }
): Promise<ResultadoOtp> {
  const app = usuario.app_metadata || {}
  const codigoLimpo = limparCodigo(codigo)

  if (!app.otp_code || !app.otp_expires) {
    return { ok: false, erro: 'Nenhum código ativo encontrado. Solicite um novo código.' }
  }
  if (Date.now() > app.otp_expires) {
    return { ok: false, erro: 'O código de verificação expirou. Solicite um novo código.' }
  }
  if ((app.otp_tentativas || 0) >= MAX_TENTATIVAS_OTP) {
    return { ok: false, erro: 'Muitas tentativas incorretas. Solicite um novo código.' }
  }

  if (app.otp_code !== codigoLimpo) {
    await supabase.auth.admin.updateUserById(usuario.id, {
      app_metadata: { ...app, otp_tentativas: (app.otp_tentativas || 0) + 1 },
    })
    return { ok: false, erro: 'Código de verificação incorreto. Verifique os números recebidos.' }
  }

  if (opcoes.consumir) {
    await supabase.auth.admin.updateUserById(usuario.id, {
      app_metadata: { ...app, otp_code: null, otp_expires: null, otp_tentativas: 0 },
    })
  }
  return { ok: true }
}

/** Valida (e opcionalmente consome) o OTP pendente de um e-mail que ainda não tem conta. */
export async function verificarOtpPendente(
  supabase: SupabaseClient,
  email: string,
  codigo: unknown,
  opcoes: { consumir: boolean }
): Promise<ResultadoOtp> {
  const emailLimpo = email.trim().toLowerCase()
  const codigoLimpo = limparCodigo(codigo)

  const { data: logsOtp } = await supabase
    .from('logs_auditoria_admin')
    .select('*')
    .eq('admin_email', emailLimpo)
    .eq('tipo_acao', 'OTP_PENDENTE_NOVO_OPERADOR')
    .order('created_at', { ascending: false })
    .limit(1)

  const ultimoOtp = logsOtp?.[0]
  const dados = ultimoOtp?.dados_novos
  if (!ultimoOtp || !dados || dados.consumido) {
    return { ok: false, erro: 'Nenhum código ativo encontrado para este e-mail. Solicite um novo código.' }
  }
  if (Date.now() > (dados.expires_at || 0)) {
    return { ok: false, erro: 'O código de confirmação expirou. Solicite um novo código.' }
  }
  if ((dados.tentativas || 0) >= MAX_TENTATIVAS_OTP) {
    return { ok: false, erro: 'Muitas tentativas incorretas. Solicite um novo código.' }
  }

  if (dados.codigo !== codigoLimpo) {
    await supabase
      .from('logs_auditoria_admin')
      .update({ dados_novos: { ...dados, tentativas: (dados.tentativas || 0) + 1 } })
      .eq('id', ultimoOtp.id)
    return { ok: false, erro: 'Código de verificação de 6 dígitos incorreto.' }
  }

  if (opcoes.consumir) {
    await supabase
      .from('logs_auditoria_admin')
      .update({ dados_novos: { ...dados, consumido: true } })
      .eq('id', ultimoOtp.id)
  }
  return { ok: true }
}
