'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/contexts/ModalConfirmacaoContext'
import { obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import ModalEditarCorretor from './ModalEditarCorretor'
import styles from './AbaCorretores.module.css'
import Icone from '@/components/ui/Icone'

interface MembroEquipe {
  id: string
  nome: string
  email: string
  telefone?: string
  creci?: string
  papel: 'gestor_principal' | 'gestor' | 'corretor'
  avatar_url?: string | null
  created_at: string
  total_imoveis?: number
}

interface AbaCorretoresProps {
  imobiliariaId: string
  imobiliariaNome: string
}

export default function AbaCorretores({ imobiliariaId, imobiliariaNome }: AbaCorretoresProps) {
  const [membros, setMembros] = useState<MembroEquipe[]>([])
  const [carregando, setCarregando] = useState(true)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [mensagemFeedback, setMensagemFeedback] = useState<{ texto: string; tipo: 'sucesso' | 'erro' } | null>(null)
  const [corretorParaEditar, setCorretorParaEditar] = useState<MembroEquipe | null>(null)
  const { confirmar } = useConfirm()

  // Gerar link de convite exclusivo limpo
  const linkConvite = typeof window !== 'undefined'
    ? `${window.location.origin}/cadastro?imobiliaria=${imobiliariaId}`
    : `https://fixum.com.br/cadastro?imobiliaria=${imobiliariaId}`

  useEffect(() => {
    carregarEquipe()
  }, [imobiliariaId])

  function exibirToast(texto: string, tipo: 'sucesso' | 'erro' = 'sucesso') {
    setMensagemFeedback({ texto, tipo })
    setTimeout(() => setMensagemFeedback(null), 4000)
  }

  async function carregarEquipe() {
    setCarregando(true)
    try {
      const res = await fetch(`/api/corretores?imobiliaria_id=${imobiliariaId}`)
      const data = await res.json()
      if (data?.corretores) {
        setMembros(data.corretores)
      } else {
        setMembros([])
      }
    } catch (err) {
      console.error('Erro ao buscar equipe:', err)
      setMembros([])
    } finally {
      setCarregando(false)
    }
  }

  // Copiar link para área de transferência
  async function handleCopiarLink() {
    try {
      await navigator.clipboard.writeText(linkConvite)
      setLinkCopiado(true)
      exibirToast('Link copiado com sucesso! Envie aos corretores da sua equipe.', 'sucesso')
      setTimeout(() => setLinkCopiado(false), 3000)
    } catch {
      exibirToast('Copie o link manualmente no campo.', 'erro')
    }
  }

  // Compartilhar via WhatsApp
  function handleCompartilharWhatsApp() {
    const texto =
      `*CONVITE DE EQUIPE — ${imobiliariaNome.toUpperCase()}*\n\n` +
      `Olá! Você foi convidado para integrar a equipe oficial da *${imobiliariaNome}* na Fixum e anunciar seus imóveis com nossa cota corporativa.\n\n` +
      `*Clique no link abaixo para criar sua conta de corretor parceiro:*\n` +
      `${linkConvite}`

    const msg = encodeURIComponent(texto)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  // Alterar Papel (Promover a Gestor / Tornar Corretor)
  async function handleAlterarPapel(membroId: string, nomeMembro: string, novoPapel: 'gestor' | 'corretor') {
    const isGestor = novoPapel === 'gestor'
    const confirmou = await confirmar({
      titulo: isGestor ? 'Promover a Gestor?' : 'Definir como Corretor?',
      mensagem: isGestor
        ? `Deseja promover o membro "${nomeMembro}" a Gestor da equipe? Ele terá acesso total às configurações e gestão dos anúncios.`
        : `Deseja alterar o papel de "${nomeMembro}" para Corretor?`,
      icone: isGestor ? '' : '',
      textoBotaoConfirmar: isGestor ? 'Sim, Promover' : 'Confirmar Alteração',
      tipo: isGestor ? 'primario' : 'aviso',
    })
    if (!confirmou) return

    try {
      const res = await fetch('/api/corretores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'alterar_papel',
          corretor_id: membroId,
          novo_papel: novoPapel,
          imobiliaria_id: imobiliariaId,
        }),
      })

      const data = await res.json()
      if (data.success) {
        exibirToast(`Papel de ${nomeMembro} alterado para ${novoPapel === 'gestor' ? 'Gestor' : 'Corretor'}.`, 'sucesso')
        setMembros((prev) =>
          prev.map((m) => (m.id === membroId ? { ...m, papel: novoPapel } : m))
        )
      } else {
        exibirToast(data.error || 'Erro ao alterar papel.', 'erro')
      }
    } catch {
      exibirToast('Erro ao atualizar papel do membro.', 'erro')
    }
  }

  // Desvincular Membro
  async function handleDesvincular(corretorId: string, nomeCorretor: string) {
    const confirmou = await confirmar({
      titulo: 'Desvincular da equipe?',
      mensagem: `Deseja desvincular o membro "${nomeCorretor}" da sua imobiliária? Ele não poderá mais publicar usando a sua cota.`,
      icone: 'sair',
      textoBotaoConfirmar: 'Sim, Desvincular',
      tipo: 'perigo',
      destrutivo: true,
    })
    if (!confirmou) return

    try {
      const res = await fetch('/api/corretores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corretor_id: corretorId }),
      })
      const data = await res.json()
      if (data.success) {
        exibirToast(`${nomeCorretor} foi desvinculado da equipe.`, 'sucesso')
        setMembros((prev) => prev.filter((c) => c.id !== corretorId))
      } else {
        exibirToast(data.error || 'Não foi possível desvincular o membro.', 'erro')
      }
    } catch {
      exibirToast('Erro ao desvincular membro.', 'erro')
    }
  }

  const gestoresCount = membros.filter((m) => m.papel === 'gestor_principal' || m.papel === 'gestor').length
  const corretoresCount = membros.filter((m) => m.papel === 'corretor').length

  return (
    <div className={styles.container}>
      <div className={styles.cabecalhoAba}>
        <div>
          <h1 className={styles.tituloPrincipal}>Gestão da equipe & corretores</h1>
          <p className={styles.subtituloPrincipal}>
            Gerencie os gestores e corretores parceiros da <strong>{imobiliariaNome}</strong>. Corretores cadastram anúncios para revisão e gestores aprovam a publicação no mapa.
          </p>
        </div>
      </div>

      {mensagemFeedback && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: mensagemFeedback.tipo === 'sucesso' ? '#EEF5F0' : '#FDF1EC',
          border: `1px solid ${mensagemFeedback.tipo === 'sucesso' ? '#A9CDB6' : '#F3C3B5'}`,
          color: mensagemFeedback.tipo === 'sucesso' ? '#2E6B4E' : '#8F2812',
          fontWeight: 600,
          fontSize: '0.875rem',
        }}>
          {mensagemFeedback.tipo === 'sucesso' ? '' : ''}
          {mensagemFeedback.texto}
        </div>
      )}

      {/* ── GRID SUPERIOR COMPACTO (GESTORES, CORRETORES E CONVITE NA MESMA LINHA) ── */}
      <div className={styles.gridSuperiorEquipe}>
        {/* Card 1: Gestores */}
        <div className={styles.cardMetricaEquipe}>
          <div className={styles.iconeMetricaEquipe} style={{ background: '#FBEFD3', color: '#8A5F12' }}>
            <Icone nome="coroa" tamanho={16} />
          </div>
          <div>
            <strong className={styles.valorMetricaEquipe}>{gestoresCount}</strong>
            <span className={styles.labelMetricaEquipe}>Gestores (poder de aprovação)</span>
          </div>
        </div>

        {/* Card 2: Corretores */}
        <div className={styles.cardMetricaEquipe}>
          <div className={styles.iconeMetricaEquipe} style={{ background: '#EAE4D8', color: '#22302A' }}>
            <Icone nome="maleta" tamanho={16} />
          </div>
          <div>
            <strong className={styles.valorMetricaEquipe}>{corretoresCount}</strong>
            <span className={styles.labelMetricaEquipe}>Corretores parceiros</span>
          </div>
        </div>

        {/* Card 3: Convite Rápido Integrado */}
        <div className={styles.cardConviteCompacto}>
          <div className={styles.conviteCompactoTopo}>
            <div className={styles.conviteCompactoTitulo}>
              <span><Icone nome="link" tamanho={16} /></span> Convidar novo corretor
            </div>
            <span className={styles.conviteCompactoSub}>Link exclusivo da {imobiliariaNome}</span>
          </div>

          <div className={styles.conviteCompactoAcoes}>
            <button
              type="button"
              className={styles.btnCopiarCompacto}
              onClick={handleCopiarLink}
              title="Copiar link de cadastro da imobiliária"
            >
              {linkCopiado ? 'Copiado' : 'Copiar link'}
            </button>
            <button
              type="button"
              className={styles.btnWhatsCompacto}
              onClick={handleCompartilharWhatsApp}
              title="Compartilhar link de convite via WhatsApp"
            >
 WhatsApp
 </button>
          </div>
        </div>
      </div>

      {/* ── TABELA DE MEMBROS DA EQUIPE ── */}
      <div className={styles.cardTabela}>
        <div className={styles.tabelaTopo}>
          <div className={styles.tabelaTitulo}>
            Membros da imobiliária & cargos
          </div>
          <span className={styles.badgeContador}>
            {membros.length} {membros.length === 1 ? 'membro' : 'membros'}
          </span>
        </div>

        {carregando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#7A7264' }}>
            Carregando equipe...
          </div>
        ) : membros.length === 0 ? (
          <div className={styles.estadoVazio}>
            <div className={styles.iconeVazio}><Icone nome="pessoas" tamanho={16} /></div>
            <h3>Nenhum corretor vinculado ainda</h3>
            <p>
              Envie o link de convite acima para seus corretores parceiros. Quando eles se cadastrarem, aparecerão automaticamente aqui!
            </p>
          </div>
        ) : (
          <div className={styles.tabelaWrapper}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th>Membro da equipe</th>
                  <th>Cargo / papel</th>
                  <th>Contato</th>
                  <th>CRECI</th>
                  <th>Imóveis</th>
                  <th style={{ textAlign: 'right' }}>Ações de gestão</th>
                </tr>
              </thead>
              <tbody>
                {membros.map((c) => {
                  const isPrincipal = c.papel === 'gestor_principal'
                  const isGestor = c.papel === 'gestor' || isPrincipal

                  return (
                    <tr key={c.id}>
                      <td>
                        <div className={styles.corretorInfo}>
                          {c.avatar_url ? (
                            <img src={c.avatar_url} alt={c.nome} className={styles.corretorAvatarImg} />
                          ) : (
                            <div
                              className={styles.corretorAvatar}
                              style={{
                                background: isPrincipal
                                  ? 'linear-gradient(135deg, #E3A72F, #C08A1E)'
                                  : obterGradienteUsuario(c.id || c.email || c.nome),
                                color: '#ffffff',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                              }}
                            >
                              {isPrincipal ? '' : obterIniciaisUsuario(c.nome, c.email)}
                            </div>
                          )}
                          <div>
                            <div className={styles.corretorNome}>
                              {c.nome} {isPrincipal ? '(Você / titular)' : ''}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#7A7264' }}>{c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: isPrincipal ? '#FBEFD3' : isGestor ? '#EAE4D8' : '#F3EEE4',
                          color: isPrincipal ? '#8A5F12' : isGestor ? '#22302A' : '#5A5449',
                          border: `1px solid ${isPrincipal ? '#F2D48E' : isGestor ? '#CFC6B6' : '#E0D8CA'}`,
                        }}>
                          {isPrincipal ? 'Gestor titular' : isGestor ? 'Gestor' : 'Corretor'}
                        </span>
                      </td>
                      <td>{c.telefone || '—'}</td>
                      <td>
                        <span className={styles.corretorCreci}>{c.creci}</span>
                      </td>
                      <td>
                        <strong>{c.total_imoveis || 0}</strong> imóvel(is)
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            onClick={() => setCorretorParaEditar(c)}
                            title="Editar dados cadastrais, telefone e CRECI"
                          >
 Editar
 </button>

                          {!isPrincipal ? (
                            <>
                              {isGestor ? (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                  onClick={() => handleAlterarPapel(c.id, c.nome, 'corretor')}
                                  title="Mudar cargo para corretor"
                                >
 Tornar corretor
 </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  style={{ fontSize: '0.75rem', padding: '4px 8px', borderColor: '#CFC6B6', color: '#22302A' }}
                                  onClick={() => handleAlterarPapel(c.id, c.nome, 'gestor')}
                                  title="Promover membro a gestor com poder de aprovar anúncios"
                                >
 Promover a gestor
 </button>
                              )}

                              <button
                                type="button"
                                className={styles.btnDesvincular}
                                onClick={() => handleDesvincular(c.id, c.nome)}
                                title="Remover da equipe da imobiliária"
                              >
                                Desvincular
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edição de Corretor */}
      {corretorParaEditar && (
        <ModalEditarCorretor
          membro={corretorParaEditar}
          onFechar={() => setCorretorParaEditar(null)}
          onSalvo={(atualizado) => {
            setMembros((prev) =>
              prev.map((m) => (m.id === atualizado.id ? { ...m, ...atualizado } : m))
            )
            exibirToast(`Dados de ${atualizado.nome} atualizados com sucesso!`, 'sucesso')
          }}
        />
      )}
    </div>
  )
}
