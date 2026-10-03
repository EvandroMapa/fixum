import type { SupabaseClient } from '@supabase/supabase-js'

export type TipoNotificacao = 'revisao_pendente' | 'imovel_aprovado' | 'imovel_recusado' | 'info'

export interface NovaNotificacao {
  usuario_id: string
  titulo: string
  mensagem: string
  tipo?: TipoNotificacao
  imovel_id?: string
}

/** Grava uma notificação direto no banco (uso interno das rotas do servidor). */
export async function criarNotificacao(supabase: SupabaseClient, dados: NovaNotificacao) {
  const novaNotif = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    usuario_id: dados.usuario_id,
    titulo: dados.titulo,
    mensagem: dados.mensagem,
    tipo: dados.tipo || 'info',
    imovel_id: dados.imovel_id,
    lida: false,
    created_at: new Date().toISOString(),
  }

  try {
    await supabase.from('notificacoes').insert(novaNotif)
  } catch (err) {
    console.error('Aviso ao gravar notificação:', err)
  }

  return novaNotif
}
