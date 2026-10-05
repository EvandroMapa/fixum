import { NextResponse } from 'next/server'
import { verificarOtpPendente } from '@/lib/otp'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirAdmin } from '@/lib/auth/servidor'

export interface OperadorAdmin {
  id: string
  nome: string
  email: string
  cargo: 'master' | 'financeiro' | 'suporte'
  status_conta: 'ativo' | 'suspenso'
  created_at: string
  last_sign_in_at: string | null
  is_raiz: boolean
  /** Conta de cliente (proprietário, corretor…) que também tem acesso de administrador */
  tambem_cliente: boolean
}

const TIPOS_CLIENTE = ['corretor', 'imobiliaria', 'proprietario', 'comprador']

/**
 * Dono da plataforma: marcado em app_metadata.dono (só o servidor altera).
 * Não pode ser suspenso, excluído nem perder o acesso de admin — evita a plataforma ficar sem administrador.
 */
function ehDono(usuario: { app_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return usuario?.app_metadata?.dono === true
}

// ── GET: LISTAR TODOS OS OPERADORES ADMINISTRATIVOS ──
export async function GET(req: Request) {
  try {
    const auth = await exigirAdmin(req)
    if (!auth.ok) return auth.resposta

    const supabase = criarClienteAdmin()

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

    // 3. Todos que têm acesso de administrador (inclusive clientes promovidos: ninguém com acesso fica fora da lista)
    const operadores: OperadorAdmin[] = []

    for (const u of authData.users) {
      const p = mapaPerfis[u.id] || mapaPerfis[(u.email || '').toLowerCase()]
      const tipoPerfil = p?.tipo || u.user_metadata?.tipo
      const tambemCliente = TIPOS_CLIENTE.includes(tipoPerfil)

      const temAcessoAdmin = p?.is_admin === true || ehDono(u)

      if (temAcessoAdmin) {
        const cargoRaw = p?.cargo_admin || u.user_metadata?.cargo || 'master'
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
          is_raiz: ehDono(u),
          tambem_cliente: tambemCliente,
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
    const { acao } = body

    // 1. Sessão de administrador confirmada com o código do e-mail
    const auth = await exigirAdmin(req)
    if (!auth.ok) return auth.resposta
    const adminEmail = auth.usuario.email || 'admin'

    const supabase = criarClienteAdmin()

    // Conta de cliente com acesso de admin: aqui só dá para remover o acesso de administrador.
    // Editar, suspender, trocar senha ou excluir mexeria na conta de cliente (imóveis, assinatura).
    if (['alterar_status', 'alterar_senha', 'excluir', 'editar', 'remover_admin'].includes(acao)) {
      const { data: perfilAlvo } = await supabase.from('perfis').select('tipo').eq('id', body.operadorId).maybeSingle()
      const alvoCliente = TIPOS_CLIENTE.includes(perfilAlvo?.tipo)

      if (acao === 'remover_admin') {
        const { data: alvo } = await supabase.auth.admin.getUserById(body.operadorId)
        if (ehDono(alvo?.user)) {
          return NextResponse.json({ error: 'A conta do dono da plataforma não pode perder o acesso de administrador.' }, { status: 400 })
        }
        if (body.operadorId === auth.usuario.id) {
          return NextResponse.json({ error: 'Você não pode remover o seu próprio acesso.' }, { status: 400 })
        }
        await supabase.from('perfis').update({ is_admin: false }).eq('id', body.operadorId)
        await supabase.from('logs_auditoria_admin').insert({
          admin_email: adminEmail,
          tipo_acao: 'REMOVER_ACESSO_ADMIN',
          entidade: 'perfis',
          entidade_id: body.operadorId,
          dados_anteriores: { is_admin: true },
          dados_novos: { is_admin: false },
          justificativa: body.justificativa || 'Acesso de administrador removido',
          created_at: new Date().toISOString(),
        })
        return NextResponse.json({ sucesso: true })
      }

      if (alvoCliente) {
        return NextResponse.json(
          { error: 'Esta conta também é anunciante. Aqui só dá para remover o acesso de administrador.' },
          { status: 400 }
        )
      }
    }

    // ── AÇÃO 1: CRIAR NOVO OPERADOR ADMINISTRATIVO (COM CÓDIGO OTP) ──
    if (acao === 'criar') {
      const { nome, email, senha, cargo, codigoOtp } = body
      if (!nome || !email || !senha || !cargo) {
        return NextResponse.json({ error: 'Todos os campos são obrigatórios.' }, { status: 400 })
      }

      if (senha.length < 6) {
        return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres.' }, { status: 400 })
      }

      const emailLimpo = email.trim().toLowerCase()
      const emailAdminOrigem = adminEmail.trim().toLowerCase()

      // Validação obrigatória do Código OTP enviado ao e-mail do Novo Operador
      const otp = await verificarOtpPendente(supabase, emailLimpo, codigoOtp, { consumir: true })
      if (!otp.ok) {
        return NextResponse.json({ error: otp.erro }, { status: 400 })
      }

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
        admin_email: emailAdminOrigem,
        tipo_acao: 'CRIAR_OPERADOR_ADMIN',
        entidade: 'perfis',
        entidade_id: userId,
        dados_novos: { nome, email: emailLimpo, cargo },
        justificativa: `Criação do operador administrativo ${nome} (${cargo}) com autorização OTP`,
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
      if (ehDono(usuarioAlvo?.user)) {
        return NextResponse.json({ error: 'A conta do dono da plataforma não pode ser suspensa.' }, { status: 400 })
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
      if (ehDono(usuarioAlvo?.user)) {
        return NextResponse.json({ error: 'A conta do dono da plataforma não pode ser excluída.' }, { status: 400 })
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

    // ── AÇÃO 5: EDITAR DADOS DO OPERADOR ──
    if (acao === 'editar') {
      const { operadorId, nome, email, cargo, status_conta, justificativa } = body
      if (!operadorId || !nome || !email || !cargo) {
        return NextResponse.json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' }, { status: 400 })
      }

      const emailLimpo = email.trim().toLowerCase()

      // Proteger conta raiz contra mudança de cargo indevida
      const { data: usuarioAlvo } = await supabase.auth.admin.getUserById(operadorId)
      const isRaiz = ehDono(usuarioAlvo?.user)

      const cargoFinal = isRaiz ? 'master' : cargo
      const statusFinal = isRaiz ? 'ativo' : (status_conta || 'ativo')

      // Atualizar no Auth
      const updateAuthPayload: any = {
        user_metadata: {
          ...usuarioAlvo?.user?.user_metadata,
          nome: nome.trim(),
          cargo: cargoFinal,
          tipo: 'admin',
          is_admin: true,
        },
      }

      if (usuarioAlvo?.user?.email !== emailLimpo && !isRaiz) {
        updateAuthPayload.email = emailLimpo
        updateAuthPayload.email_confirm = true
      }

      const { error: errUpdateAuth } = await supabase.auth.admin.updateUserById(operadorId, updateAuthPayload)
      if (errUpdateAuth) {
        return NextResponse.json({ error: `Erro ao atualizar dados no Auth: ${errUpdateAuth.message}` }, { status: 400 })
      }

      // Atualizar no banco (perfis)
      await supabase.from('perfis').update({
        nome: nome.trim(),
        email: isRaiz ? (usuarioAlvo?.user?.email || emailLimpo) : emailLimpo,
        cargo_admin: cargoFinal,
        status_conta: statusFinal,
      }).eq('id', operadorId)

      // Registrar auditoria
      await supabase.from('logs_auditoria_admin').insert({
        admin_email: adminEmail || 'admin@fixum.com.br',
        tipo_acao: 'EDITAR_OPERADOR_ADMIN',
        entidade: 'perfis',
        entidade_id: operadorId,
        dados_novos: { nome, email: emailLimpo, cargo: cargoFinal, status_conta: statusFinal },
        justificativa: justificativa || `Edição de cadastro do operador ${nome}`,
        created_at: new Date().toISOString(),
      })

      return NextResponse.json({ sucesso: true })
    }

    return NextResponse.json({ error: 'Ação não reconhecida.' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar ação de operador' }, { status: 500 })
  }
}
