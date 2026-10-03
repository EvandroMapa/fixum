import { NextResponse } from 'next/server'
import { salvarMetadadosLead } from '@/lib/leadsMetadata'
import { enviarAlertaLeadEmail } from '@/lib/email'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { listarMembrosEquipe } from '@/lib/auth/contexto-conta'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { imovel_id, nome, telefone, email, mensagem } = body

    if (!imovel_id || !nome || !telefone) {
      return NextResponse.json({ error: 'imovel_id, nome e telefone são obrigatórios.' }, { status: 400 })
    }

    const supabase = criarClienteAdmin()

    // 1. Buscar dados do imóvel
    const { data: imovel, error: errImovel } = await supabase
      .from('imoveis')
      .select('id, titulo, codigo, preco, negociacao, bairro, cidade, anunciante_id')
      .eq('id', imovel_id)
      .single()

    if (errImovel || !imovel) {
      return NextResponse.json({ error: 'Imóvel não encontrado.' }, { status: 404 })
    }

    // 2. Buscar perfil do anunciante
    const { data: anunciante } = await supabase
      .from('perfis')
      .select('id, nome, email, telefone, tipo, imobiliaria_id, regra_distribuicao_leads, whatsapp_destino')
      .eq('id', imovel.anunciante_id)
      .maybeSingle()

    let corretorAtribuidoId: string | null = imovel.anunciante_id
    let corretorAtribuidoNome = anunciante?.nome || 'Anunciante'
    let emailNotificacao = anunciante?.email || ''

    // Se o imóvel pertence a uma Imobiliária (ou corretor vinculado)
    const ehImobiliaria = anunciante?.tipo === 'imobiliaria' || !!anunciante?.imobiliaria_id
    const imobiliariaId = anunciante?.imobiliaria_id || (anunciante?.tipo === 'imobiliaria' ? anunciante.id : null)

    if (ehImobiliaria && imobiliariaId) {
      // Buscar dados da imobiliária matriz para verificar a regra
      const { data: perfilMatriz } = await supabase
        .from('perfis')
        .select('id, nome, email, telefone, regra_distribuicao_leads, whatsapp_destino')
        .eq('id', imobiliariaId)
        .maybeSingle()

      const regra = perfilMatriz?.regra_distribuicao_leads || anunciante?.regra_distribuicao_leads || 'captador'

      if (regra === 'gestor') {
        // Modelo 3: Centralizado na Gestão
        corretorAtribuidoId = null
        corretorAtribuidoNome = 'Gestão da Imobiliária'
        emailNotificacao = perfilMatriz?.email || anunciante?.email || ''
      } else if (regra === 'roleta') {
        // Modelo 2: Roleta Automática (Round-Robin entre membros da equipe)
        const { data: donoImob } = await supabase.auth.admin.getUserById(imobiliariaId)
        const membrosVinculados = await listarMembrosEquipe(supabase, imobiliariaId)
        const membrosEquipe = (donoImob?.user ? [donoImob.user, ...membrosVinculados] : membrosVinculados)
          .map((u) => ({
            id: u.id,
            nome: u.user_metadata?.nome || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Corretor',
            email: u.email || '',
            telefone: u.user_metadata?.telefone || '',
          }))

        if (membrosEquipe.length > 0) {
          const indiceSorteado = Math.floor(Math.random() * membrosEquipe.length)
          const sorteado = membrosEquipe[indiceSorteado]
          corretorAtribuidoId = sorteado.id
          corretorAtribuidoNome = sorteado.nome
          emailNotificacao = sorteado.email
        }
      } else {
        // Modelo 1: 'captador' (Padrão: quem cadastrou recebe)
        corretorAtribuidoId = imovel.anunciante_id
        corretorAtribuidoNome = anunciante?.nome || 'Corretor Captador'
        emailNotificacao = anunciante?.email || perfilMatriz?.email || ''
      }
    }

    // 3. Inserir lead na tabela oficial
    const { data: leadCriado, error: errLead } = await supabase
      .from('leads')
      .insert({
        imovel_id,
        nome,
        telefone,
        mensagem: mensagem || '',
        status: 'novo',
      })
      .select()
      .single()

    if (errLead) {
      console.error('Erro ao inserir lead no banco:', errLead)
      return NextResponse.json({ error: 'Falha ao salvar lead.' }, { status: 500 })
    }

    // 4. Salvar metadados com atribuição de corretor
    salvarMetadadosLead(leadCriado.id, {
      corretor_id: corretorAtribuidoId,
      corretor_nome: corretorAtribuidoNome,
      temperatura: 'quente',
    })

    // 5. Disparar notificação por e-mail via Resend (se houver e-mail válido)
    if (emailNotificacao) {
      try {
        await enviarAlertaLeadEmail({
          emailCorretor: emailNotificacao,
          nomeCorretor: corretorAtribuidoNome,
          nomeLead: nome,
          telefoneLead: telefone,
          emailLead: email || '',
          mensagem: mensagem || '',
          tituloImovel: imovel.titulo,
          codigoImovel: imovel.codigo || imovel.id.slice(0, 8),
        })
      } catch (errEmail) {
        console.error('Aviso: Falha ao enviar e-mail de alerta de lead:', errEmail)
      }
    }

    return NextResponse.json({
      success: true,
      lead_id: leadCriado.id,
      atribuido_a: corretorAtribuidoNome,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro ao processar lead.' }, { status: 500 })
  }
}
