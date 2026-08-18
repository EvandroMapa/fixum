export const CONFIG_PADRAO = {
  WHATSAPP_COMERCIAL: '5531988027152',
  WHATSAPP_SUPORTE: '5531988027152',
  EMAIL_CONTATO: 'contato@fixum.com.br',
}

/**
 * Retorna o link direto para o WhatsApp comercial com mensagem opcional
 */
export function linkWhatsAppComercial(numero?: string, mensagem?: string): string {
  const numLimpo = (numero || CONFIG_PADRAO.WHATSAPP_COMERCIAL).replace(/\D/g, '')
  const msgTexto = mensagem
    ? `?text=${encodeURIComponent(mensagem)}`
    : ''
  return `https://wa.me/${numLimpo}${msgTexto}`
}
