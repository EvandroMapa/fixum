/**
 * FIXUM — Migração única: copia o vínculo com a imobiliária (imobiliaria_id) e o papel (gestor/corretor)
 * de user_metadata para app_metadata em todos os usuários do Supabase Auth.
 *
 * Por quê: o servidor agora decide permissões SOMENTE por app_metadata (que só a service role altera).
 * user_metadata pode ser editado pelo próprio usuário via supabase.auth.updateUser().
 *
 * Uso (na raiz do projeto, com .env.local preenchido):
 *   node supabase/seguranca/02-migrar-vinculo-app-metadata.mjs            → simulação (não grava nada)
 *   node supabase/seguranca/02-migrar-vinculo-app-metadata.mjs --aplicar  → grava
 *
 * Não apaga nada: só acrescenta/atualiza as chaves imobiliaria_id e papel em app_metadata.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const aplicar = process.argv.includes('--aplicar')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const usuarios = []
for (let pagina = 1; pagina <= 50; pagina++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 1000 })
  if (error) throw error
  usuarios.push(...data.users)
  if (data.users.length < 1000) break
}

// Conta de imobiliária: perfis.tipo ou o tipo declarado no cadastro (há contas com os dois divergentes)
const idsImobiliarias = new Set()
const { data: perfisImob } = await supabase.from('perfis').select('id').eq('tipo', 'imobiliaria')
;(perfisImob || []).forEach((p) => idsImobiliarias.add(p.id))
usuarios
  .filter((u) => u.user_metadata?.tipo === 'imobiliaria' || u.user_metadata?.tipo_anunciante === 'imobiliaria')
  .forEach((u) => idsImobiliarias.add(u.id))

let alterados = 0
for (const u of usuarios) {
  const meta = u.user_metadata || {}
  const app = u.app_metadata || {}

  let imobiliariaId = meta.imobiliaria_id || null
  if (imobiliariaId === u.id) imobiliariaId = null
  if (imobiliariaId && !idsImobiliarias.has(imobiliariaId)) {
    console.warn(`  ⚠️  ${u.email}: imobiliaria_id ${imobiliariaId} não é uma imobiliária em perfis — vínculo ignorado`)
    imobiliariaId = null
  }
  const papel = imobiliariaId ? (meta.papel === 'gestor' ? 'gestor' : 'corretor') : null

  if ((app.imobiliaria_id ?? null) === imobiliariaId && (app.papel ?? null) === papel) continue

  alterados++
  console.log(`${aplicar ? '✔' : '→'} ${u.email}: imobiliaria_id=${imobiliariaId} papel=${papel}`)
  if (aplicar) {
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      app_metadata: { ...app, imobiliaria_id: imobiliariaId, papel },
    })
    if (error) console.error(`  ✖ erro em ${u.email}:`, error.message)
  }
}

console.log(`\n${usuarios.length} usuários lidos, ${alterados} ${aplicar ? 'atualizados' : 'seriam atualizados (rode com --aplicar)'}.`)
