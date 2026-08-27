import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { CHAVE_SECRETA_ADMIN_PADRAO } from '@/lib/admin-auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxiaubwwzcnpmwfbvvrt.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4aWF1Ynd3emNucG13ZmJ2dnJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjY1OTM0NSwiZXhwIjoyMTAyMjM1MzQ1fQ.uHbg0JE9v929ErRqhuEeUxYXPvpIjAVK9Rs4YwSka3s'

export interface OperadorAdmin {
  id: string
  nome: string
  email: string
  cargo: 'master' | 'financeiro' | 'suporte'
  status_conta: 'ativo' | 'suspenso'
  created_at: string
  last_sign_in_at: string | null
  is_raiz: boolean
}

// ── GET: LISTAR TODOS OS OPERADORES ADMINISTRATIVOS ──
export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Buscar todos os usuários do Auth
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }

    // 2. Buscar perfis correspondentes
    const { data: perfisData } = await supabase.from('perfis').select('*')
    const mapaPerfis: Record<string, any> = {}
    ;(perfisData || []).forEach((p) => {
      mapaPerfis[p.id] = p
      if (p.email) mapaPerfis[p.email.toLowerCase()] = p
    })

    // 3. Filtrar apenas quem é Administrador
    const operadores: OperadorAdmin[] = []

    for (const u of authData.users) {
      const p = mapaPerfis[u.id] || mapaPerfis[(u.email || '').toLowerCase()]
      const tipoPerfil = p?.tipo || u.user_metadata?.tipo

      // Bloquear sumariamente qualquer usuário que seja cliente da plataforma (corretor, imobiliária, proprietário, comprador)
      const isClientePlataforma = ['corretor', 'imobiliaria', 'proprietario', 'comprador'].includes(tipoPerfil)

      const ehOperadorInterno = !isClientePlataforma && (
        u.email === 'admin@fixum.com.br' ||
        (p?.tipo === 'admin' && p?.is_admin === true) ||
        (u.user_metadata?.tipo === 'admin' && u.user_metadata?.is_admin === true)
      )

      if (ehOperadorInterno) {
        const cargoRaw = p?.cargo_admin || u.user_metadata?.cargo || (u.email === 'admin@fixum.com.br' ? 'master' : 'master')
        const cargoFinal: 'master' | 'financeiro' | 'suporte' =
          ['master', 'financeiro', 'suporte'].includes(cargoRaw) ? cargoRaw : 'master'

        operadores.push({
          id: u.id,
          nome: p?.nome || u.user_metadata?.nome || u.user_metadata?.full_name || 'Administrador',
          email: u.email || '',
          cargo: cargoFinal,
          status_conta: (p?.status_conta === 'suspenso' ? 'suspenso' : 'ativo'),
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at || null,
          is_raiz: u.email === 'admin@fixum.com.br',
        })
      }
    }

    // Ordenar: conta raiz primeiro, depois por data de criação
    operadores.sort((a, b) => {
      if (a.is_raiz) return -1
      if (b.is_raiz) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return NextResponse.json({ operadores })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao carregar operadores' }, { status: 500 })
  }
}

// ── POST: AÇÕES DE GESTÃO DE OPERADORES (CRIAR, STATUS, SENHA, EXCLUIR) ──
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { acao, adminPin, adminEmail } = body

    // 1. Validação de Segurança com Chave Secreta Master
    if (!adminPin || adminPin.trim() !== CHAVE_SECRETA_ADMIN_PADRAO) {
      return NextResponse.json({ error: 'Chave Secreta Master inválida. Ação bloqueada.' }, { status: 403 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── AÇÃO 1: CRIAR NOVO OPERADOR ADMINISTRATIVO ──
    if (acao === 'criar') {
      const { nome, email, senha, cargo } = body
      if (!nome || !email || !senha || !cargo) {
        return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
      }

      if (senha.length < 6) {
        return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres.' }, { status: 400 })
      }

      const emailLimpo = email.trim().toLowerCase()

      // Criar usuário no Auth
      const { data: novoAuth, error: errAuth } = await supabase.auth.admin.createUser({
        email: emailLimpo,
        password: senha,
        email_confirm: true,
        user_metadata: {
          nome: nome.trim(),
          tipo: 'admin',
          is_admin: true,
          cargo,
        },
      })

      if (errAuth) {
        return NextResponse.json({ error: `Erro ao criar operador: ${errAuth.message}` }, { status: 400 })
      }

      const userId = novoAuth.user.id

      // Criar perfil administrativo
      await supabase.from('perfis').upsert({
        id: userId,
        nome: nome.trim(),
        email: emailLimpo,
        tipo: 'admin',
        is_admin: true,
        cargo_admin: cargo,
        status_conta: 'ativo',
        created_at: new Date().toISOString(),
      })

      // Auditoria
      await supabase.from('logs_auditoria_admin').insert({
        admin_email: adminEmail || 'admin@fixum.com.br',
        tipo_acao: 'CRIAR_OPERADOR_ADMIN',
        entidade: 'perfis',
        entidade_id: userId,
        dados_novos: { nome, email: emailLimpo, cargo },
        justificativa: `Criação do operador administrativo ${nome} (${cargo})`,
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({ sucesso: true, id: userId })
    }

    // ── AÇÃO 2: ALTERAR STATUS (ATIVAR / SUSPENDER) ──
    if (acao === 'alterar_status') {
      const { operadorId, novoStatus, justificativa } = body
      if (!operadorId || !novoStatus) {
        return NextResponse.json({ error: 'ID do operador e novo status são obrigatórios.' }, { status: 400 })
      }

      // Proteger conta raiz
      const { data: usuarioAlvo } = await supabase.auth.admin.getUserById(operadorId)
      if (usuarioAlvo?.user?.email === 'admin@fixum.com.br') {
        return NextResponse.json({ error: 'A conta raiz admin@fixum.com.br não pode ser suspensa.' }, { status: 400 })
      }

      await supabase
        .from('perfis')
        .update({
          status_conta: novoStatus,
          motivo_suspensao: novoStatus === 'suspenso' ? (justificativa || 'Suspensão manual pelo administrador') : null,
        })
        .eq('id', operadorId)

      await supabase.from('logs_auditoria_admin').insert({
        admin_email: adminEmail || 'admin@fixum.com.br',
        tipo_acao: novoStatus === 'suspenso' ? 'SUSPENDER_OPERADOR_ADMIN' : 'REATIVAR_OPERADOR_ADMIN',
        entidade: 'perfis',
        entidade_id: operadorId,
        dados_novos: { status_conta: novoStatus },
        justificativa: justificativa || `Alteração de status para ${novoStatus}`,
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({ sucesso: true })
    }

    // ── AÇÃO 3: REDEFINIR SENHA DO OPERADOR ──
    if (acao === 'alterar_senha') {
      const { operadorId, novaSenha, justificativa } = body
      if (!operadorId || !novaSenha || novaSenha.length < 6) {
        return NextResponse.json({ error: 'Senha inválida (mínimo 6 caracteres).' }, { status: 400 })
      }

      const { error: errSenha } = await supabase.auth.admin.updateUserById(operadorId, {
        password: novaSenha,
      })

      if (errSenha) {
        return NextResponse.json({ error: `Falha ao alterar senha: ${errSenha.message}` }, { status: 400 })
      }

      await supabase.from('logs_auditoria_admin').insert({
        admin_email: adminEmail || 'admin@fixum.com.br',
        tipo_acao: 'ALTERAR_SENHA_OPERADOR_ADMIN',
        entidade: 'perfis',
        entidade_id: operadorId,
        justificativa: justificativa || 'Redefinição de senha administrativa',
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({ sucesso: true })
    }

    // ── AÇÃO 4: EXCLUIR OPERADOR ──
    if (acao === 'excluir') {
      const { operadorId, justificativa } = body
      if (!operadorId) {
        return NextResponse.json({ error: 'ID do operador é obrigatório.' }, { status: 400 })
      }

      const { data: usuarioAlvo } = await supabase.auth.admin.getUserById(operadorId)
      if (usuarioAlvo?.user?.email === 'admin@fixum.com.br') {
        return NextResponse.json({ error: 'A conta raiz admin@fixum.com.br não pode ser excluída.' }, { status: 400 })
      }

      await supabase.auth.admin.deleteUser(operadorId)
      await supabase.from('perfis').delete().eq('id', operadorId)

      await supabase.from('logs_auditoria_admin').insert({
        admin_email: adminEmail || 'admin@fixum.com.br',
        tipo_acao: 'EXCLUIR_OPERADOR_ADMIN',
        entidade: 'perfis',
        entidade_id: operadorId,
        dados_anteriores: { email: usuarioAlvo?.user?.email },
        justificativa: justificativa || 'Exclusão de operador administrativo',
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({ sucesso: true })
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar ação de operador' }, { status: 500 })
  }
}
