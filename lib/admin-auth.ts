/**
 * Autenticação e Blindagem do Painel Administrativo Fixum
 */

// Chave Secreta Master da Fixum (pode ser sobrescrita via .env.local)
export const CHAVE_SECRETA_ADMIN_PADRAO = process.env.NEXT_PUBLIC_ADMIN_PIN || 'FIXUM-MASTER-2026'

const CHAVE_STORAGE_ADMIN = 'fixum_admin_session_token'

export interface SessaoAdmin {
  email: string
  autenticadoEm: number
  expiraEm: number
}

/**
 * Salva a sessão autenticada de admin no sessionStorage (fechou a aba/navegador, perde o acesso)
 */
export function salvarSessaoAdmin(email: string): void {
  if (typeof window === 'undefined') return
  const sessao: SessaoAdmin = {
    email,
    autenticadoEm: Date.now(),
    expiraEm: Date.now() + 4 * 60 * 60 * 1000, // 4 horas de sessão
  }
  sessionStorage.setItem(CHAVE_STORAGE_ADMIN, JSON.stringify(sessao))
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
}
