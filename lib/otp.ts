import type { SupabaseClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'

/**
 * Código de 6 dígitos para confirmar o e-mail de um novo OPERADOR do painel admin (guardado em logs_auditoria_admin).
 * Login e cadastro de clientes usam o código nativo do Supabase Auth, não este módulo.
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
