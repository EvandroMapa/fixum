import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verificação em duas etapas com app autenticador (TOTP), usando o MFA nativo do Supabase.
 * Funções para uso no navegador (componentes 'use client').
 */

/** Se a sessão ainda precisa do código do app autenticador, devolve o ID do fator a confirmar. */
export async function fatorPendente(supabase: SupabaseClient): Promise<string | null> {
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!nivel || nivel.nextLevel !== 'aal2' || nivel.currentLevel === 'aal2') return null

  const { data: fatores } = await supabase.auth.mfa.listFactors()
  return fatores?.totp?.[0]?.id ?? null
}

/** Confirma o código de 6 dígitos do app autenticador e eleva a sessão para aal2. */
export async function confirmarCodigoTotp(supabase: SupabaseClient, fatorId: string, codigo: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fatorId, code: codigo.replace(/\D/g, '') })
  if (error) throw new Error('Código incorreto ou expirado. Confira o app autenticador e tente de novo.')
}

export interface NovoFatorTotp {
  id: string
  /** QR code em SVG (data URL) para escanear no app autenticador */
  qrCode: string
  /** Chave para digitar manualmente, se a pessoa não conseguir escanear */
  segredo: string
}

/** Inicia o cadastro do app autenticador (gera o QR code). Descarta tentativas anteriores não concluídas. */
export async function iniciarCadastroTotp(supabase: SupabaseClient): Promise<NovoFatorTotp> {
  const { data: fatores } = await supabase.auth.mfa.listFactors()
  const pendentes = (fatores?.all || []).filter((f) => f.factor_type === 'totp' && f.status !== 'verified')
  for (const f of pendentes) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    // Nome único: o Supabase recusa dois fatores com o mesmo nome (ex.: efeito rodando duas vezes em dev)
    friendlyName: `Fixum ${new Date().toISOString().slice(0, 10)} ${Math.random().toString(36).slice(2, 7)}`,
    issuer: 'Fixum',
  })
  if (error || !data) throw new Error('Não foi possível iniciar o cadastro do app autenticador. Tente novamente.')

  return { id: data.id, qrCode: data.totp.qr_code, segredo: data.totp.secret }
}

/** Lista os apps autenticadores já confirmados na conta. */
export async function listarTotpAtivos(supabase: SupabaseClient) {
  const { data } = await supabase.auth.mfa.listFactors()
  return data?.totp || []
}

/** Remove o app autenticador (exige sessão aal2: a pessoa precisa ter confirmado o código nesta sessão). */
export async function removerTotp(supabase: SupabaseClient, fatorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId: fatorId })
  if (error) throw new Error('Para desativar, confirme antes o código do app autenticador nesta sessão.')
}
