'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from './AbaCorretores.module.css'

interface CorretorVinculado {
  id: string
  nome: string
  email: string
  telefone?: string
  creci?: string
  created_at: string
  total_imoveis?: number
}

interface AbaCorretoresProps {
  imobiliariaId: string
  imobiliariaNome: string
}

export default function AbaCorretores({ imobiliariaId, imobiliariaNome }: AbaCorretoresProps) {
  const [corretores, setCorretores] = useState<CorretorVinculado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [mensagemFeedback, setMensagemFeedback] = useState<{ texto: string; tipo: 'sucesso' | 'erro' } | null>(null)

  // Gerar link de convite exclusivo limpo
  const linkConvite = typeof window !== 'undefined'
    ? `${window.location.origin}/cadastro?imobiliaria=${imobiliariaId}`
    : `https://fixum.com.br/cadastro?imobiliaria=${imobiliariaId}`

  useEffect(() => {
    carregarCorretores()
  }, [imobiliariaId])

  function exibirToast(texto: string, tipo: 'sucesso' | 'erro' = 'sucesso') {
    setMensagemFeedback({ texto, tipo })
    setTimeout(() => setMensagemFeedback(null), 4000)
  }

  async function carregarCorretores() {
    setCarregando(true)
    try {
      const res = await fetch(`/api/corretores?imobiliaria_id=${imobiliariaId}`)
      const data = await res.json()
      if (data?.corretores) {
        setCorretores(data.corretores)
      } else {
        setCorretores([])
      }
    } catch (err) {
      console.error('Erro ao buscar corretores:', err)
      setCorretores([])
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
      `👉 *Clique no link abaixo para criar sua conta de corretor parceiro:*\n` +
      `${linkConvite}`

    const msg = encodeURIComponent(texto)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  // Desvincular Corretor
  async function handleDesvincular(corretorId: string, nomeCorretor: string) {
    if (!confirm(`Deseja desvincular o corretor "${nomeCorretor}" da sua imobiliária?`)) return

    try {
      const res = await fetch('/api/corretores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corretor_id: corretorId }),
      })
      const data = await res.json()
      if (data.success) {
        exibirToast(`${nomeCorretor} foi desvinculado da equipe.`, 'sucesso')
        setCorretores((prev) => prev.filter((c) => c.id !== corretorId))
      } else {
        exibirToast(data.error || 'Não foi possível desvincular o corretor.', 'erro')
      }
    } catch {
      exibirToast('Erro ao desvincular corretor.', 'erro')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.cabecalhoAba}>
        <div>
          <h1 className={styles.tituloPrincipal}>Equipe de Corretores</h1>
          <p className={styles.subtituloPrincipal}>
            Gerencie os corretores parceiros que anunciam imóveis sob a conta corporativa da sua imobiliária
          </p>
        </div>
      </div>

      {mensagemFeedback && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: mensagemFeedback.tipo === 'sucesso' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${mensagemFeedback.tipo === 'sucesso' ? '#86efac' : '#fecaca'}`,
          color: mensagemFeedback.tipo === 'sucesso' ? '#15803d' : '#b91c1c',
          fontWeight: 600,
          fontSize: '0.875rem',
        }}>
          {mensagemFeedback.tipo === 'sucesso' ? '✅ ' : '⚠️ '}
          {mensagemFeedback.texto}
        </div>
      )}

      {/* ── CARD DE CONVITE COM LINK EXCLUSIVO ── */}
      <div className={styles.cardConvite}>
        <div className={styles.conviteTopo}>
          <div>
            <div className={styles.conviteTitulo}>🔗 Link de Convite da Sua Imobiliária</div>
            <div className={styles.conviteDesc}>
              Qualquer corretor que se cadastrar através deste link será automaticamente vinculado à <strong>{imobiliariaNome}</strong> e poderá cadastrar imóveis utilizando a cota corporativa do seu plano.
            </div>
          </div>
        </div>

        <div className={styles.boxLinkInput}>
          <input
            type="text"
            readOnly
            value={linkConvite}
            className={styles.inputLink}
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            type="button"
            className={styles.btnCopiarLink}
            onClick={handleCopiarLink}
          >
            {linkCopiado ? '✅ Copiado!' : '📋 Copiar Link'}
          </button>
          <button
            type="button"
            className={styles.btnWhatsConvite}
            onClick={handleCompartilharWhatsApp}
          >
            💬 Convidar via WhatsApp
          </button>
        </div>
      </div>

      {/* ── TABELA DE CORRETORES ATIVOS ── */}
      <div className={styles.cardTabela}>
        <div className={styles.tabelaTopo}>
          <div className={styles.tabelaTitulo}>
            Corretores Cadastrados na Imobiliária
          </div>
          <span className={styles.badgeContador}>
            {corretores.length} {corretores.length === 1 ? 'corretor' : 'corretores'}
          </span>
        </div>

        {carregando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            Carregando equipe de corretores...
          </div>
        ) : corretores.length === 0 ? (
          <div className={styles.estadoVazio}>
            <div className={styles.iconeVazio}>👥</div>
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
                  <th>Corretor</th>
                  <th>Contato</th>
                  <th>CRECI</th>
                  <th>Imóveis Cadastrados</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {corretores.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className={styles.corretorInfo}>
                        <div className={styles.corretorAvatar}>
                          {c.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className={styles.corretorNome}>{c.nome}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{c.telefone || '—'}</td>
                    <td>
                      <span className={styles.corretorCreci}>{c.creci}</span>
                    </td>
                    <td>
                      <strong>{c.total_imoveis}</strong> imóvel(is)
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnDesvincular}
                        onClick={() => handleDesvincular(c.id, c.nome)}
                      >
                        Desvincular
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
