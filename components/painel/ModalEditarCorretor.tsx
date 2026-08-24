'use client'

import { useState } from 'react'
import styles from './ModalEditarCorretor.module.css'

interface MembroEquipe {
  id: string
  nome: string
  email: string
  telefone?: string
  creci?: string
  papel: 'gestor_principal' | 'gestor' | 'corretor'
}

interface Props {
  membro: MembroEquipe
  onFechar: () => void
  onSalvo: (membroAtualizado: MembroEquipe) => void
}

export default function ModalEditarCorretor({ membro, onFechar, onSalvo }: Props) {
  const [nome, setNome] = useState(membro.nome || '')
  const [email, setEmail] = useState(membro.email || '')
  const [telefone, setTelefone] = useState(membro.telefone || '')
  const [creci, setCreci] = useState(membro.creci !== 'Não informado' ? membro.creci || '' : '')
  const [papel, setPapel] = useState<'gestor' | 'corretor'>(membro.papel === 'gestor_principal' ? 'gestor' : (membro.papel as any) || 'corretor')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const isPrincipal = membro.papel === 'gestor_principal'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('O nome do corretor é obrigatório.')
      return
    }

    try {
      setSalvando(true)
      setErro(null)

      const res = await fetch('/api/corretores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'editar_corretor',
          corretor_id: membro.id,
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim(),
          creci: creci.trim() || 'Não informado',
          papel: isPrincipal ? 'gestor_principal' : papel,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao atualizar dados do corretor.')
      }

      onSalvo({
        ...membro,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        creci: creci.trim() || 'Não informado',
        papel: isPrincipal ? 'gestor_principal' : papel,
      })
      onFechar()
    } catch (err: any) {
      console.error('Erro ao salvar corretor:', err)
      setErro(err?.message || 'Falha ao salvar alterações.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className={styles.cabecalho}>
          <div className={styles.tituloWrapper}>
            <div className={styles.iconeModal}>✏️</div>
            <div>
              <h2 className={styles.titulo}>Editar Dados do Corretor</h2>
              <span className={styles.subtitulo}>Atualize os dados de contato e registro profissional</span>
            </div>
          </div>
          <button type="button" className={styles.btnFechar} onClick={onFechar}>
            ✕
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className={styles.formulario}>
          {erro && <div className={styles.erroBox}>{erro}</div>}

          <div className={styles.campo}>
            <label className={styles.label}>Nome Completo *</label>
            <input
              type="text"
              className={styles.input}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Rodrigo Mendes"
              required
            />
          </div>

          <div className={styles.gridCampos}>
            <div className={styles.campo}>
              <label className={styles.label}>E-mail de Acesso *</label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: corretor@imobiliaria.com"
                required
              />
            </div>

            <div className={styles.campo}>
              <label className={styles.label}>WhatsApp / Telefone *</label>
              <input
                type="text"
                className={styles.input}
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex: (31) 98877-6655"
              />
            </div>
          </div>

          <div className={styles.gridCampos}>
            <div className={styles.campo}>
              <label className={styles.label}>Registro CRECI</label>
              <input
                type="text"
                className={styles.input}
                value={creci}
                onChange={(e) => setCreci(e.target.value)}
                placeholder="Ex: MG-12345"
              />
            </div>

            {!isPrincipal && (
              <div className={styles.campo}>
                <label className={styles.label}>Cargo na Equipe</label>
                <select
                  className={styles.input}
                  value={papel}
                  onChange={(e) => setPapel(e.target.value as any)}
                >
                  <option value="corretor">👔 Corretor Parceiro</option>
                  <option value="gestor">🛡️ Gestor da Equipe</option>
                </select>
              </div>
            )}
          </div>

          {/* Rodapé de botões */}
          <div className={styles.rodape}>
            <button
              type="button"
              className={styles.btnCancelar}
              onClick={onFechar}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.btnSalvar}
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
