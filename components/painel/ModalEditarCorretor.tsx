'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { obterIniciaisUsuario, obterGradienteUsuario } from '@/lib/utils'
import styles from './ModalEditarCorretor.module.css'

export interface MembroEquipe {
  id: string
  nome: string
  email: string
  telefone?: string
  creci?: string
  papel: 'gestor_principal' | 'gestor' | 'corretor'
  avatar_url?: string | null
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
  const [avatarUrl, setAvatarUrl] = useState<string>(membro.avatar_url || '')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const inputFileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const isPrincipal = membro.papel === 'gestor_principal'

  async function handleSelecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFoto(true)
    setErro(null)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const nomeArquivo = `corretor_${membro.id}_${Date.now()}.${ext}`
      const caminho = `avatares/${nomeArquivo}`

      const { error: uploadError } = await supabase.storage
        .from('fotos-imoveis')
        .upload(caminho, file, { contentType: file.type, upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('fotos-imoveis')
        .getPublicUrl(caminho)

      setAvatarUrl(publicUrl)
    } catch (err: any) {
      console.error('Erro ao fazer upload da foto:', err)
      setErro('Não foi possível enviar a foto. Tente novamente.')
    } finally {
      setUploadingFoto(false)
      if (inputFileRef.current) inputFileRef.current.value = ''
    }
  }

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
          avatar_url: avatarUrl || null,
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
        avatar_url: avatarUrl || null,
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
              <span className={styles.subtitulo}>Atualize os dados de contato, foto e registro profissional</span>
            </div>
          </div>
          <button type="button" className={styles.btnFechar} onClick={onFechar}>
            ✕
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className={styles.formulario}>
          {erro && <div className={styles.erroBox}>{erro}</div>}

          {/* 📸 SEÇÃO DE FOTO DO CORRETOR */}
          <div className={styles.secaoFoto}>
            <div className={styles.avatarPreviewWrapper}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={nome} className={styles.avatarImg} />
              ) : (
                <div
                  className={styles.avatarFallback}
                  style={{ background: obterGradienteUsuario(nome || 'Corretor') }}
                >
                  {obterIniciaisUsuario(nome || 'Corretor')}
                </div>
              )}
            </div>

            <div className={styles.fotoInfo}>
              <span className={styles.labelFoto}>Foto de Perfil</span>
              <span className={styles.sublabelFoto}>
                Exibida no ranking, no pódio e nos cards de atendimento
              </span>
              <div className={styles.linhaBotoesFoto}>
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelecionarFoto}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className={styles.btnUploadFoto}
                  onClick={() => inputFileRef.current?.click()}
                  disabled={uploadingFoto}
                >
                  {uploadingFoto ? 'Enviando foto...' : avatarUrl ? '📷 Alterar Foto' : '📷 Adicionar Foto'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    className={styles.btnRemoverFoto}
                    onClick={() => setAvatarUrl('')}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

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

          <div className={styles.campo}>
            <label className={styles.label}>E-mail de Login</label>
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rodrigo@exemplo.com.br"
            />
          </div>

          <div className={styles.gridCampos}>
            <div className={styles.campo}>
              <label className={styles.label}>WhatsApp / Telefone</label>
              <input
                type="text"
                className={styles.input}
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(31) 99999-9999"
              />
            </div>

            <div className={styles.campo}>
              <label className={styles.label}>Número do CRECI</label>
              <input
                type="text"
                className={styles.input}
                value={creci}
                onChange={(e) => setCreci(e.target.value)}
                placeholder="Ex: MG-12345"
              />
            </div>
          </div>

          {/* Papel na Equipe */}
          {!isPrincipal ? (
            <div className={styles.campo}>
              <label className={styles.label}>Papel na Equipe</label>
              <div className={styles.grupoRadios}>
                <label className={`${styles.radioCard} ${papel === 'corretor' ? styles.radioCardAtivo : ''}`}>
                  <input
                    type="radio"
                    name="papel"
                    value="corretor"
                    checked={papel === 'corretor'}
                    onChange={() => setPapel('corretor')}
                  />
                  <div>
                    <span className={styles.radioTitulo}>👤 Corretor</span>
                    <span className={styles.radioDesc}>Anuncia imóveis com a cota e atende seus leads</span>
                  </div>
                </label>

                <label className={`${styles.radioCard} ${papel === 'gestor' ? styles.radioCardAtivo : ''}`}>
                  <input
                    type="radio"
                    name="papel"
                    value="gestor"
                    checked={papel === 'gestor'}
                    onChange={() => setPapel('gestor')}
                  />
                  <div>
                    <span className={styles.radioTitulo}>👑 Gestor / Gerente</span>
                    <span className={styles.radioDesc}>Acesso total aos anúncios, equipe e homologação de vendas</span>
                  </div>
                </label>
              </div>
            </div>
          ) : (
            <div className={styles.infoPrincipal}>
              <span>👑</span>
              <p>Este membro é o <strong>Gestor Titular / Administrador Master</strong> da imobiliária.</p>
            </div>
          )}

          {/* Rodapé */}
          <div className={styles.rodape}>
            <button type="button" className={styles.btnCancelar} onClick={onFechar} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className={styles.btnSalvar} disabled={salvando || uploadingFoto}>
              {salvando ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
