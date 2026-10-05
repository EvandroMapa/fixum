/**
 * FIXUM — Define uma senha nova para uma conta (padrão: admin@fixum.com.br).
 * A senha é digitada no terminal e enviada direto ao Supabase; não fica salva em arquivo.
 *
 * Uso (na raiz do projeto, com .env.local preenchido):
 *   node supabase/seguranca/04-definir-senha-usuario.mjs                      → admin@fixum.com.br
 *   node supabase/seguranca/04-definir-senha-usuario.mjs fulano@exemplo.com   → outra conta
 */
import { createClient } from '@supabase/supabase-js'
import readline from 'readline'
import fs from 'fs'

const EMAIL_ADMIN = (process.argv[2] || 'admin@fixum.com.br').trim().toLowerCase()

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

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const perguntar = (texto) => new Promise((resolve) => rl.question(texto, resolve))

const senha = (await perguntar(`Nova senha para ${EMAIL_ADMIN} (mín. 12 caracteres): `)).trim()
const confirmacao = (await perguntar('Repita a nova senha: ')).trim()
rl.close()

if (senha.length < 12) {
  console.error('✖ A senha precisa ter pelo menos 12 caracteres. Nada foi alterado.')
  process.exit(1)
}
if (senha !== confirmacao) {
  console.error('✖ As senhas não conferem. Nada foi alterado.')
  process.exit(1)
}

const usuarios = []
for (let pagina = 1; pagina <= 50; pagina++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 1000 })
  if (error) throw error
  usuarios.push(...data.users)
  if (data.users.length < 1000) break
}

const admin = usuarios.find((u) => (u.email || '').toLowerCase() === EMAIL_ADMIN)
if (!admin) {
  console.error(`✖ Conta ${EMAIL_ADMIN} não encontrada.`)
  process.exit(1)
}

const { error } = await supabase.auth.admin.updateUserById(admin.id, { password: senha })
if (error) {
  console.error('✖ Erro ao definir a senha:', error.message)
  process.exit(1)
}

console.log(`✔ Senha de ${EMAIL_ADMIN} atualizada. Já pode entrar com ela.`)
console.log('  Dica: guarde-a num gerenciador de senhas, não em arquivos .txt do projeto.')
