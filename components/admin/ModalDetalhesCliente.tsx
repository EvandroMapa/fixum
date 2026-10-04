'use client'

import React, { useState } from 'react'
import { ClienteAdmin360 } from '@/lib/admin-service'
import { PLANOS_OFICIAIS, formatarMoeda } from '@/lib/planos'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import styles from './ModalDetalhesCliente.module.css'
import Icone from '@/components/ui/Icone'

interface ModalDetalhesClienteProps {
  cliente: ClienteAdmin360 | null
  onFechar: () => void
  onAtualizarPlano: (clienteId: string, novoPlanoId: string, justificativa: string) => Promise<void>
  onAlterarStatusConta: (clienteId: string, novoStatus: 'ativo' | 'suspenso', justificativa: string) => Promise<void>
  onSalvarNotas: (clienteId: string, notas: string) => Promise<void>
  onVerImoveis: (clienteId: string) => void
  onSelecionarOutroCliente?: (clienteId: string) => void
}

export default function ModalDetalhesCliente({
  cliente,
  onFechar,
  onAtualizarPlano,
  onAlterarStatusConta,
  onSalvarNotas,
  onVerImoveis,
  onSelecionarOutroCliente,
}: ModalDetalhesClienteProps) {
  const { confirmar, alertar } = useConfirm()
  const [novoPlano, setNovoPlano] = useState(cliente?.plano_id || 'gratis')
  const [justificativaPlano, setJustificativaPlano] = useState('')
  const [editandoPlano, setEditandoPlano] = useState(false)
  const [salvandoPlano, setSalvandoPlano] = useState(false)

  const [notas, setNotas] = useState(cliente?.notas_admin || '')
  const [salvandoNotas, setSalvandoNotas] = useState(false)
  const [msgNotas, setMsgNotas] = useState(false)

  if (!cliente) return null

  const whatsLimpo = (cliente.whatsapp || cliente.telefone || '').replace(/\D/g, '')

  async function handleConfirmarTrocaPlano(e: React.FormEvent) {
    e.preventDefault()
    if (!cliente) return

    if (!justificativaPlano.trim()) {
      await alertar({
        titulo: 'Justificativa obrigatória',
        mensagem: 'Por motivos de auditoria e segurança, você deve preencher uma justificativa para alterar o plano manualmente.',
        icone: 'alerta',
        tipo: 'aviso',
      })
      return
    }

    const confirmou = await confirmar({
      titulo: 'Alterar plano manualmente?',
      mensagem: `Deseja realmente alterar o plano de ${cliente.nome} para o plano "${PLANOS_OFICIAIS.find((p) => p.id === novoPlano)?.nome}"? Esta ação será registrada na trilha de auditoria.`,
      icone: 'coroa',
      textoBotaoConfirmar: 'Sim, alterar plano',
      tipo: 'primario',
    })

    if (!confirmou) return

    setSalvandoPlano(true)
    await onAtualizarPlano(cliente.id, novoPlano, justificativaPlano)
    setSalvandoPlano(false)
    setEditandoPlano(false)
  }

  async function handleToggleStatus() {
    if (!cliente) return
    const isAtivo = cliente.status_conta === 'ativo'
    const acaoTexto = isAtivo ? 'Suspender' : 'Reativar'

    const confirmou = await confirmar({
      titulo: `${acaoTexto} Conta de ${cliente.nome}?`,
      mensagem: isAtivo
        ? 'Ao suspender este anunciante, o acesso ao painel será bloqueado e seus anúncios serão pausados no portal.'
        : 'Ao reativar, o anunciante voltará a ter acesso normal ao portal.',
      icone: isAtivo ? '' : '',
      textoBotaoConfirmar: `Sim, ${acaoTexto}`,
      tipo: isAtivo ? 'perigo' : 'sucesso',
      destrutivo: isAtivo,
    })

    if (!confirmou) return

    const justificativa = isAtivo ? 'Suspensão manual aplicada pela administração' : 'Reativação manual autorizada'
    await onAlterarStatusConta(cliente.id, isAtivo ? 'suspenso' : 'ativo', justificativa)
  }

  async function handleSalvarNotasInternas() {
    if (!cliente) return
    setSalvandoNotas(true)
    await onSalvarNotas(cliente.id, notas)
    setSalvandoNotas(false)
    setMsgNotas(true)
    setTimeout(() => setMsgNotas(false), 3000)
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* ── CABEÇALHO ── */}
        <div className={styles.cabecalho}>
          <div className={styles.perfilTopo}>
            <div className={styles.avatar}>
              {cliente.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className={styles.linhaNome}>
                <h2 className={styles.nome}>{cliente.nome}</h2>
                <span className={`${styles.badgeStatus} ${cliente.status_conta === 'ativo' ? styles.statusAtivo : styles.statusSuspenso}`}>
                  {cliente.status_conta === 'ativo' ? 'Conta ativa' : 'Conta suspensa'}
                </span>
                <span className={styles.badgeTipo}>
                  {cliente.tipo_anunciante === 'imobiliaria' ? 'Imobiliária (gestora)' : 
                   cliente.is_corretor_vinculado ? `Corretor Vinculado` :
                   cliente.tipo_anunciante === 'corretor' ? 'Corretor Autônomo' : 'Proprietário'}
                </span>
              </div>
              <p className={styles.sub}>{cliente.email} • Cadastro em {new Date(cliente.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <button type="button" className={styles.btnFechar} onClick={onFechar}><Icone nome="fechar" tamanho={16} /></button>
        </div>

        {/* ── CORPO ── */}
        <div className={styles.corpo}>
          {/* BANNER INFORMATIVO SE FOR CORRETOR VINCULADO */}
          {cliente.is_corretor_vinculado && (
            <div className={styles.bannerEquipeVinculada}>
              <div className={styles.bannerEquipeIcone}><Icone nome="predio" tamanho={16} /></div>
              <div className={styles.bannerEquipeTexto}>
                <strong>Membro da equipe de: {cliente.imobiliaria_nome || 'Imobiliária Vinculada'}</strong>
                <p>
                  Este corretor está vinculado à cota corporativa da imobiliária. Quem contrata o plano e é responsável pelo faturamento é a <strong>{cliente.imobiliaria_nome}</strong>.
                </p>
              </div>
              {cliente.imobiliaria_id && onSelecionarOutroCliente && (
                <button
                  type="button"
                  className={styles.btnVerImobiliariaDona}
                  onClick={() => onSelecionarOutroCliente(cliente.imobiliaria_id!)}
                >
                  Ver imobiliária responsável →
                </button>
              )}
            </div>
          )}

          {/* Grid de Informações Rápidas */}
          <div className={styles.gridCards}>
            <div className={styles.cardInfo}>
              <span className={styles.cardLabel}>Plano & responsabilidade</span>
              <div className={styles.cardValorPlano}>{cliente.plano_nome}</div>
              <span className={styles.cardSub}>
                {cliente.is_corretor_vinculado ? 'Faturamento via imobiliária' : `${formatarMoeda(cliente.plano_preco)}/mês`}
              </span>
            </div>

            <div className={styles.cardInfo}>
              <span className={styles.cardLabel}>Carteira de imóveis</span>
              <div className={styles.cardValor}>{cliente.total_imoveis}</div>
              <span className={styles.cardSub}>{cliente.imoveis_ativos} ativos • {cliente.imoveis_destaque} destaques</span>
            </div>

            <div className={styles.cardInfo}>
              <span className={styles.cardLabel}>Faturamento direto</span>
              <div className={styles.cardValor}>
                {cliente.is_corretor_vinculado ? '—' : formatarMoeda(cliente.valor_total_gasto)}
              </div>
              <span className={styles.cardSub}>
                {cliente.is_corretor_vinculado ? 'Pago pela imobiliária' : `${cliente.total_faturas_pagas} fatura(s) quitada(s)`}
              </span>
            </div>

            <div className={styles.cardInfo}>
              <span className={styles.cardLabel}>Região / cidade</span>
              <div className={styles.cardValorPequeno}>{cliente.cidade || 'Não informada'} {cliente.uf ? `— ${cliente.uf}` : ''}</div>
              <span className={styles.cardSub}>{cliente.creci ? `CRECI: ${cliente.creci}` : (cliente.cpf_cnpj ? `Doc: ${cliente.cpf_cnpj}` : 'Documento pendente')}</span>
            </div>
          </div>

          {/* SE FOR IMOBILIÁRIA: LISTAR EQUIPE DE CORRETORES VINCULADOS */}
          {cliente.tipo_anunciante === 'imobiliaria' && (
            <div className={styles.secaoEquipe}>
              <div className={styles.secaoPlanoHeader}>
                <h3 className={styles.secaoTitulo}>
 Equipe de corretores vinculados ({cliente.corretores_equipe?.length || 0})
                </h3>
              </div>
              {(!cliente.corretores_equipe || cliente.corretores_equipe.length === 0) ? (
                <p className={styles.dadoVazio}>Nenhum corretor vinculado à equipe desta imobiliária ainda.</p>
              ) : (
                <div className={styles.tabelaEquipeWrapper}>
                  <table className={styles.tabelaEquipe}>
                    <thead>
                      <tr>
                        <th>Corretor</th>
                        <th>Contato</th>
                        <th>CRECI</th>
                        <th>Imóveis cadastrados</th>
                        <th>Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cliente.corretores_equipe.map((corretor) => (
                        <tr key={corretor.id}>
                          <td><strong>{corretor.nome}</strong></td>
                          <td>{corretor.email}</td>
                          <td>{corretor.creci || '—'}</td>
                          <td><strong>{corretor.total_imoveis}</strong> imóvel(is)</td>
                          <td>
                            {onSelecionarOutroCliente && (
                              <button
                                type="button"
                                className={styles.btnVerCorretor}
                                onClick={() => onSelecionarOutroCliente(corretor.id)}
                              >
                                Ver corretor →
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Contatos e Links Rápidos */}
          <div className={styles.secaoContatos}>
            <h3 className={styles.secaoTitulo}>Contato com o cliente</h3>
            <div className={styles.linhaAcoesContato}>
              {whatsLimpo ? (
                <a
                  href={`https://wa.me/${whatsLimpo.startsWith('55') ? whatsLimpo : `55${whatsLimpo}`}?text=Ol%C3%A1%20${encodeURIComponent(cliente.nome)},%20sou%20da%20equipe%20Fixum.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.btnWhats}
                >
 Abrir WhatsApp ({cliente.whatsapp || cliente.telefone})
                </a>
              ) : (
                <span className={styles.dadoVazio}>WhatsApp não cadastrado</span>
              )}

              <a href={`mailto:${cliente.email}`} className={styles.btnEmail}>
 Enviar e-mail
 </a>

              <button
                type="button"
                className={styles.btnVerImoveis}
                onClick={() => {
                  onFechar()
                  onVerImoveis(cliente.id)
                }}
              >
 Ver {cliente.total_imoveis} Imóveis do cliente →
              </button>
            </div>
          </div>

          {/* Gestão do Plano Manual (Apenas para Contas Pagadoras: Imobiliárias, Corretores Autônomos e Proprietários) */}
          <div className={styles.secaoPlano}>
            <div className={styles.secaoPlanoHeader}>
              <h3 className={styles.secaoTitulo}>Gestão administrativa do plano</h3>
              {!editandoPlano && !cliente.is_corretor_vinculado && (
                <button
                  type="button"
                  className={styles.btnEditarPlano}
                  onClick={() => setEditandoPlano(true)}
                >
 Alterar plano manualmente
 </button>
              )}
            </div>

            {cliente.is_corretor_vinculado ? (
              <p style={{ color: '#A39A8A', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
 Este corretor utiliza o plano corporativo da imobiliária. Para alterar capacidade, altere o plano da <strong>{cliente.imobiliaria_nome}</strong>.
              </p>
            ) : editandoPlano ? (
              <form onSubmit={handleConfirmarTrocaPlano} className={styles.formPlano}>
                <div className={styles.campoForm}>
                  <label className={styles.labelForm}>Selecione o novo plano:</label>
                  <select
                    value={novoPlano}
                    onChange={(e) => setNovoPlano(e.target.value)}
                    className={styles.selectForm}
                  >
                    {PLANOS_OFICIAIS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — {formatarMoeda(p.preco_mensal)}/mês (até {p.limite_imoveis_max} imóveis)
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.campoForm}>
                  <label className={styles.labelForm}>
                    <span>Justificativa obrigatória para auditoria:</span>
                    <span style={{ color: '#E8836B', fontSize: '0.75rem' }}>* Obrigatório</span>
                  </label>
                  <input
                    type="text"
                    value={justificativaPlano}
                    onChange={(e) => setJustificativaPlano(e.target.value)}
                    placeholder="Ex: Cortesia comercial anual acordada via WhatsApp / Upgrade promocional"
                    className={styles.inputForm}
                    required
                  />
                </div>

                <div className={styles.linhaBotoesPlano}>
                  <button
                    type="submit"
                    disabled={salvandoPlano}
                    className={styles.btnSalvarPlano}
                  >
                    {salvandoPlano ? 'Salvando...' : 'Confirmar e registrar log'}
                  </button>
                  <button
                    type="button"
                    className={styles.btnCancelarPlano}
                    onClick={() => setEditandoPlano(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          {/* Anotações Internas da Equipe */}
          <div className={styles.secaoNotas}>
            <div className={styles.secaoPlanoHeader}>
              <h3 className={styles.secaoTitulo}>Notas internas & histórico da equipe</h3>
              {msgNotas && <span className={styles.msgSucesso}>Notas salvas com sucesso!</span>}
            </div>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Adicione observações sobre negociações, contatos realizados, preferências do cliente ou acordos especiais..."
              rows={3}
              className={styles.textareaNotas}
            />
            <button
              type="button"
              disabled={salvandoNotas}
              onClick={handleSalvarNotasInternas}
              className={styles.btnSalvarNotas}
            >
              {salvandoNotas ? 'Salvando...' : 'Salvar anotações'}
            </button>
          </div>
        </div>

        {/* ── RODAPÉ ── */}
        <div className={styles.rodape}>
          <button
            type="button"
            className={`${styles.btnAcaoConta} ${cliente.status_conta === 'ativo' ? styles.btnSuspender : styles.btnReativar}`}
            onClick={handleToggleStatus}
          >
            {cliente.status_conta === 'ativo' ? 'Suspender acesso da conta' : 'Reativar acesso da conta'}
          </button>
          <button type="button" className={styles.btnFecharRodape} onClick={onFechar}>
            Fechar detalhes
          </button>
        </div>
      </div>
    </div>
  )
}
