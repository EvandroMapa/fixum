import fs from 'fs'
import path from 'path'

const METADATA_FILE = path.resolve(process.cwd(), 'data_metadados_leads.json')

export interface LeadMetadata {
  valor_proposta?: number | null
  valor_fechamento?: number | null
  data_visita?: string | null
  data_primeiro_contato?: string | null
  data_ultimo_contato?: string | null
  corretor_id?: string | null
  corretor_nome?: string | null
  motivo_perda?: string | null
  temperatura?: 'quente' | 'morno' | 'frio' | null
  status_homologacao?: 'pendente' | 'aprovado' | 'rejeitado' | null
  homologado_por_id?: string | null
  homologado_por_nome?: string | null
  data_homologacao?: string | null
  motivo_rejeicao_homologacao?: string | null
  arquivado?: boolean | null
  data_arquivamento?: string | null
}

export function lerTodosMetadadosLeads(): Record<string, LeadMetadata> {
  try {
    if (!fs.existsSync(METADATA_FILE)) return {}
    const raw = fs.readFileSync(METADATA_FILE, 'utf8')
    return JSON.parse(raw || '{}')
  } catch (e) {
    console.error('Erro ao ler metadados de leads:', e)
    return {}
  }
}

export function obterMetadadosLead(leadId: string): LeadMetadata {
  const todos = lerTodosMetadadosLeads()
  return todos[leadId] || {}
}

export function salvarMetadadosLead(leadId: string, novosDados: Partial<LeadMetadata>): LeadMetadata {
  try {
    const todos = lerTodosMetadadosLeads()
    const atual = todos[leadId] || {}
    const atualizado = { ...atual, ...novosDados }
    todos[leadId] = atualizado
    fs.writeFileSync(METADATA_FILE, JSON.stringify(todos, null, 2), 'utf8')
    return atualizado
  } catch (e) {
    console.error('Erro ao salvar metadados de lead:', e)
    return novosDados as LeadMetadata
  }
}
