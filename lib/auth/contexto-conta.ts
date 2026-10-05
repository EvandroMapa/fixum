import type { SupabaseClient, User } from '@supabase/supabase-js'
import { obterMetadadosLead } from '@/lib/leadsMetadata'

/**
 * Contexto de permissões de uma conta (imobiliária, gestor, corretor vinculado ou autônomo).
 *
 * O vínculo com a imobiliária (imobiliaria_id) e o papel (gestor/corretor) são lidos de app_metadata,
 * que SÓ pode ser escrito pelo servidor (service role). user_metadata continua sendo espelhado para a UI,
 * mas nunca é usado para decidir permissões, pois o próprio usuário consegue alterá-lo via auth.updateUser().
 */

export type PapelEquipe = 'gestor_principal' | 'gestor' | 'corretor'

export interface ContextoConta {
  id: string
  nome: string
  tipo: string
  imobiliariaId: string | null
  papel: PapelEquipe
  isImobiliaria: boolean
  isGestor: boolean
  isCorretorVinculado: boolean
}

/**
 * Colunas de perfis que podem ir para páginas e APIs públicas (contato comercial).
 * Nunca usar select('*') em perfis numa resposta pública: a tabela tem cpf_cnpj, notas_admin, is_admin etc.
 */
export const COLUNAS_PERFIL_PUBLICO =
  'id, nome, email, tipo, foto_url, telefone, whatsapp, creci, cidade, uf, modo_exibicao_preco, created_at'

/** A conta é uma imobiliária? (perfis.tipo ou o tipo declarado no cadastro — há contas com os dois divergentes) */
export function ehContaImobiliaria(tipoPerfil: string | null | undefined, metaUsuario: Record<string, unknown> = {}): boolean {
  return tipoPerfil === 'imobiliaria' || metaUsuario.tipo === 'imobiliaria' || metaUsuario.tipo_anunciante === 'imobiliaria'
}

export function lerVinculo(usuario: Pick<User, 'app_metadata'>): { imobiliariaId: string | null; papel: PapelEquipe | null } {
  const app = usuario.app_metadata || {}
  const papel = app.papel === 'gestor' || app.papel === 'corretor' ? (app.papel as PapelEquipe) : null
  return { imobiliariaId: app.imobiliaria_id || null, papel }
}

/** Lista todos os usuários do Auth (paginado — listUsers() sozinho devolve só os primeiros 50). */
export async function listarTodosUsuarios(supabase: SupabaseClient): Promise<User[]> {
  const todos: User[] = []
  const porPagina = 1000
  for (let pagina = 1; pagina <= 50; pagina++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: porPagina })
    if (error) throw error
    const lote = data?.users || []
    todos.push(...lote)
    if (lote.length < porPagina) break
  }
  return todos
}

/** Membros vinculados a uma imobiliária (não inclui a conta dona da imobiliária). */
export async function listarMembrosEquipe(supabase: SupabaseClient, imobiliariaId: string): Promise<User[]> {
  const usuarios = await listarTodosUsuarios(supabase)
  return usuarios.filter((u) => u.id !== imobiliariaId && lerVinculo(u).imobiliariaId === imobiliariaId)
}

export async function obterContextoConta(supabase: SupabaseClient, usuario: User): Promise<ContextoConta> {
  const meta = usuario.user_metadata || {}
  const { data: perfil } = await supabase
    .from('perfis')
    .select('tipo, nome')
    .eq('id', usuario.id)
    .maybeSingle()

  const tipo = perfil?.tipo || meta.tipo || meta.tipo_anunciante || 'proprietario'
  const isImobiliaria = tipo === 'imobiliaria' || meta.tipo === 'imobiliaria' || meta.tipo_anunciante === 'imobiliaria'
  const vinculo = lerVinculo(usuario)

  const imobiliariaId = isImobiliaria ? usuario.id : vinculo.imobiliariaId
  const papel: PapelEquipe = isImobiliaria ? 'gestor_principal' : vinculo.papel || 'corretor'
  const isCorretorVinculado = !isImobiliaria && !!imobiliariaId
  const isGestor = isImobiliaria || (isCorretorVinculado && papel === 'gestor')

  return {
    id: usuario.id,
    nome: perfil?.nome || meta.nome || meta.full_name || usuario.email?.split('@')[0] || 'Usuário',
    tipo,
    imobiliariaId,
    papel,
    isImobiliaria,
    isGestor,
    isCorretorVinculado,
  }
}

/** IDs de anunciantes cujos imóveis a conta pode gerenciar (ela mesma, ou a equipe inteira se for gestor). */
export async function idsGerenciaveis(supabase: SupabaseClient, ctx: ContextoConta): Promise<string[]> {
  if (!ctx.isGestor || !ctx.imobiliariaId) return [ctx.id]
  const membros = await listarMembrosEquipe(supabase, ctx.imobiliariaId)
  return Array.from(new Set([ctx.id, ctx.imobiliariaId, ...membros.map((m) => m.id)]))
}

/** Verifica se a conta pode agir sobre TODOS os imóveis informados. */
export async function podeAcessarImoveis(
  supabase: SupabaseClient,
  ctx: ContextoConta,
  imovelIds: string[]
): Promise<boolean> {
  const ids = Array.from(new Set(imovelIds.filter(Boolean)))
  if (ids.length === 0) return false

  const { data: imoveis } = await supabase.from('imoveis').select('id, anunciante_id').in('id', ids)
  if (!imoveis || imoveis.length !== ids.length) return false

  if (imoveis.every((i) => i.anunciante_id === ctx.id)) return true
  if (!ctx.isGestor) return false

  const permitidos = new Set(await idsGerenciaveis(supabase, ctx))
  return imoveis.every((i) => permitidos.has(i.anunciante_id))
}

/** Verifica se a conta pode ver/alterar um lead (dono do imóvel, gestor da equipe ou corretor atribuído). */
export async function podeAcessarLead(supabase: SupabaseClient, ctx: ContextoConta, leadId: string): Promise<boolean> {
  if (!leadId) return false

  const { data: lead } = await supabase.from('leads').select('id, imovel_id').eq('id', leadId).maybeSingle()
  if (!lead) return false

  if (lead.imovel_id && (await podeAcessarImoveis(supabase, ctx, [lead.imovel_id]))) return true

  return obterMetadadosLead(leadId).corretor_id === ctx.id
}
