/**
 * Autenticação e Blindagem do Painel Administrativo Fixum
 * Camadas de segurança Zero-Trust: Supabase Auth + Verificação is_admin + PIN Master + Timeout de Inatividade + Auditoria
 */

import { createClient } from '@/lib/supabase/client'

// Chave Secreta Master da Fixum (pode ser sobrescrita via .env.local)
export const CHAVE_SECRETA_ADMIN_PADRAO = process.env.NEXT_PUBLIC_ADMIN_PIN || 'FIXUM-MASTER-2026'

const CHAVE_STORAGE_ADMIN = 'fixum_admin_session_token'
const CHAVE_STORAGE_BLOQUEIO = 'fixum_admin_lock_state'
const CHAVE_STORAGE_ULTIMA_ATIVIDADE = 'fixum_admin_last_activity'

// Tempo limite de inatividade para auto-bloqueio da tela (30 minutos em milissegundos)
export const TIMEOUT_INATIVIDADE_MS = 30 * 60 * 1000

export interface SessaoAdmin {
  email: string
  autenticadoEm: number
  expiraEm: number
}

export interface RegistroLogAuditoria {
  adminEmail: string
  tipoAcao: string
  entidade: string
  entidadeId?: string
  dadosAnteriores?: any
  dadosNovos?: any
  justificativa: string
}

/**
 * Salva a sessão autenticada de admin no sessionStorage (fechou a aba/navegador, perde o acesso)
 */
export function salvarSessaoAdmin(email: string): void {
  if (typeof window === 'undefined') return
  const agora = Date.now()
  const sessao: SessaoAdmin = {
    email,
    autenticadoEm: agora,
    expiraEm: agora + 8 * 60 * 60 * 1000, // 8 horas de sessão máxima
  }
  sessionStorage.setItem(CHAVE_STORAGE_ADMIN, JSON.stringify(sessao))
  sessionStorage.setItem(CHAVE_STORAGE_ULTIMA_ATIVIDADE, agora.toString())
  sessionStorage.removeItem(CHAVE_STORAGE_BLOQUEIO)
}

/**
 * Atualiza a marca de última atividade do admin (evita bloqueio por inatividade enquanto estiver em uso)
 */
export function registrarAtividadeAdmin(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(CHAVE_STORAGE_ULTIMA_ATIVIDADE, Date.now().toString())
}

/**
 * Verifica se a tela deve ser bloqueada por inatividade (mais de 30 min sem ação)
 */
export function isSessaoBloqueadaPorInatividade(): boolean {
  if (typeof window === 'undefined') return false
  if (sessionStorage.getItem(CHAVE_STORAGE_BLOQUEIO) === 'true') return true

  const ultimaAtividade = parseInt(sessionStorage.getItem(CHAVE_STORAGE_ULTIMA_ATIVIDADE) || '0', 10)
  if (!ultimaAtividade) return false

  if (Date.now() - ultimaAtividade > TIMEOUT_INATIVIDADE_MS) {
    sessionStorage.setItem(CHAVE_STORAGE_BLOQUEIO, 'true')
    return true
  }
  return false
}

/**
 * Bloqueia manualmente a tela do painel administrativo (Lock Screen)
 */
export function bloquearTelaAdmin(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(CHAVE_STORAGE_BLOQUEIO, 'true')
}

/**
 * Desbloqueia a tela administrativa com o PIN Master
 */
export function desbloquearTelaComPin(pin: string): boolean {
  if (typeof window === 'undefined') return false
  if (pin.trim() === CHAVE_SECRETA_ADMIN_PADRAO) {
    sessionStorage.removeItem(CHAVE_STORAGE_BLOQUEIO)
    sessionStorage.setItem(CHAVE_STORAGE_ULTIMA_ATIVIDADE, Date.now().toString())
    return true
  }
  return false
}

/**
 * Verifica se há uma sessão de admin ativa e válida
 */
export function isSessaoAdminValida(): boolean {
  if (typeof window === 'undefined') return false
  const bruto = sessionStorage.getItem(CHAVE_STORAGE_ADMIN)
  if (!bruto) return false

  try {
    const sessao: SessaoAdmin = JSON.parse(bruto)
    if (Date.now() > sessao.expiraEm) {
      encerrarSessaoAdmin()
      return false
    }
    return true
  } catch {
    encerrarSessaoAdmin()
    return false
  }
}

/**
 * Encerra a sessão administrativa
 */
export function encerrarSessaoAdmin(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(CHAVE_STORAGE_ADMIN)
  sessionStorage.removeItem(CHAVE_STORAGE_BLOQUEIO)
  sessionStorage.removeItem(CHAVE_STORAGE_ULTIMA_ATIVIDADE)
}

/**
 * Registra log imutável de auditoria no Supabase
 */
export async function registrarLogAuditoria(log: RegistroLogAuditoria): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('logs_auditoria_admin').insert({
      admin_id: user?.id || null,
      admin_email: log.adminEmail || user?.email || 'admin@fixum.com.br',
      tipo_acao: log.tipoAcao,
      entidade: log.entidade,
      entidade_id: log.entidadeId || null,
      dados_anteriores: log.dadosAnteriores || null,
      dados_novos: log.dadosNovos || null,
      justificativa: log.justificativa,
      ip: 'cliente_web',
      user_agent: typeof window !== 'undefined' ? navigator.userAgent : 'servidor',
    })
  } catch (err) {
    console.error('[AUDITORIA] Falha ao gravar log no banco:', err)
  }
}
