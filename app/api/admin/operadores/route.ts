import { NextResponse } from 'next/server'
import { verificarOtpPendente } from '@/lib/otp'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { exigirAdmin, pinAdminValido, respostaPinInvalido } from '@/lib/auth/servidor'

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

    // 3. Filtrar apenas quem é Administrador
    const operadores: OperadorAdmin[] = []

    for (const u of authData.users) {
      const p = mapaPerfis[u.id] || mapaPerfis[(u.email || '').toLowerCase()]
      const tipoPerfil = p?.tipo || u.user_metadata?.tipo

      // Bloquear sumariamente qualquer usuário que seja cliente da plataforma (corretor, imobiliária, proprietário, comprador)
      const isClientePlataforma = ['corretor', 'imobiliaria', 'proprietario', 'comprador'].includes(tipoPerfil)

      const ehOperadorInterno = !isClientePlataforma && (
        u.email === 'admin@fixum.com.br' ||
        (p?.tipo === 'admin' && p?.is_admin === true)
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
    const { acao, adminPin } = body

    // 1. Sessão de administrador + PIN Master (conferido no servidor) nas ações em que o admin digita o PIN
    const auth = await exigirAdmin(req)
    if (!auth.ok) return auth.resposta
    const adminEmail = auth.usuario.email || 'admin'

    if (['criar', 'alterar_senha', 'editar'].includes(acao) && !pinAdminValido(adminPin)) {
      return respostaPinInvalido()
    }

    const supabase = criarClienteAdmin()

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

    // ── AÇÃO 5: EDITAR DADOS DO OPERADOR ──
    if (acao === 'editar') {
      const { operadorId, nome, email, cargo, status_conta, justificativa } = body
      if (!operadorId || !nome || !email || !cargo) {
        return NextResponse.json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' }, { status: 400 })
      }

      const emailLimpo = email.trim().toLowerCase()

      // Proteger conta raiz contra mudança de cargo indevida
      const { data: usuarioAlvo } = await supabase.auth.admin.getUserById(operadorId)
      const isRaiz = usuarioAlvo?.user?.email === 'admin@fixum.com.br'

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
        email: isRaiz ? 'admin@fixum.com.br' : emailLimpo,
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
