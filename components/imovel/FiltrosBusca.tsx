'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { type FiltrosBusca, type TipoNegociacao } from '@/lib/types'
import BuscaAutoComplete, { type Sugestao } from './BuscaAutoComplete'
import styles from './FiltrosBusca.module.css'

interface Props {
  filtros: FiltrosBusca
  onChange: (filtros: FiltrosBusca) => void
  onLocalSelecionado?: (sugestao: Sugestao) => void
}

const GRUPOS_TIPO = [
  {
    grupo: 'Residencial',
    icone: '🏠',
    tipos: [
      { valor: 'apartamento',     label: 'Apartamento' },
      { valor: 'casa',            label: 'Casa' },
      { valor: 'sobrado',         label: 'Sobrado' },
      { valor: 'casa_condominio', label: 'Casa em Condomínio' },
      { valor: 'cobertura',       label: 'Cobertura' },
      { valor: 'kitnet',          label: 'Kitnet / Studio' },
      { valor: 'flat',            label: 'Flat' },
      { valor: 'lote',            label: 'Lote' },
    ],
  },
  {
    grupo: 'Comercial',
    icone: '🏢',
    tipos: [
      { valor: 'sala_comercial',    label: 'Sala Comercial' },
      { valor: 'loja',              label: 'Loja / Ponto Comercial' },
      { valor: 'galpao',            label: 'Galpão' },
      { valor: 'predio',            label: 'Prédio Comercial' },
      { valor: 'garagem',           label: 'Garagem' },
      { valor: 'terreno_comercial', label: 'Terreno / Lote' },
    ],
  },
  {
    grupo: 'Rural',
    icone: '🌾',
    tipos: [
      { valor: 'sitio',   label: 'Sítio' },
      { valor: 'chacara', label: 'Chácara' },
      { valor: 'fazenda', label: 'Fazenda' },
      { valor: 'rancho',  label: 'Rancho' },
      { valor: 'outro',   label: 'Outro' },
    ],
  },
]

// Lista flat para uso em outros contextos
const TIPOS = GRUPOS_TIPO.flatMap((g) => g.tipos)

const QUARTOS = [1, 2, 3, 4, 5]

export default function FiltrosBusca({ filtros, onChange, onLocalSelecionado }: Props) {
  const [modalAberto, setModalAberto] = useState<string | null>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnTipoRef = useRef<HTMLButtonElement>(null)
  const dropTipoRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (
        dropTipoRef.current && !dropTipoRef.current.contains(e.target as Node) &&
        btnTipoRef.current && !btnTipoRef.current.contains(e.target as Node)
      ) {
        setModalAberto(null)
      }
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  function abrirTipo() {
    if (btnTipoRef.current) {
      const rect = btnTipoRef.current.getBoundingClientRect()
      const dropW = 560
      // Garante que não sai pela direita
      const left = Math.min(rect.left, window.innerWidth - dropW - 8)
      setDropPos({ top: rect.bottom + 8, left: Math.max(8, left) })
    }
    setModalAberto((v) => v === 'tipo' ? null : 'tipo')
  }

  function handleNegociacao(neg: TipoNegociacao) {
    // Radio: sempre seleciona, nunca deseleciona
    if (filtros.negociacao !== neg) {
      onChange({ ...filtros, negociacao: neg })
    }
  }

  function toggleTipo(tipo: string) {
    const atual = filtros.tipo ?? []
    const novo = atual.includes(tipo as never)
      ? atual.filter((t) => t !== tipo)
      : [...atual, tipo as never]
    onChange({ ...filtros, tipo: novo.length ? novo : undefined })
  }

  // Pill de categoria: toggle todos os tipos do grupo
  function toggleCategoria(grupo: typeof GRUPOS_TIPO[0]) {
    const valoresGrupo = grupo.tipos.map((t) => t.valor)
    const atual = filtros.tipo ?? []
    const algumAtivo = valoresGrupo.some((v) => atual.includes(v as never))
    if (algumAtivo) {
      // Deseleciona todos do grupo
      const novo = atual.filter((t) => !valoresGrupo.includes(t as string))
      onChange({ ...filtros, tipo: novo.length ? novo : undefined })
    } else {
      // Seleciona todos do grupo
      const novo = [...new Set([...atual, ...valoresGrupo])] as never[]
      onChange({ ...filtros, tipo: novo })
    }
  }

  function categoriaTemAtivo(grupo: typeof GRUPOS_TIPO[0]) {
    return grupo.tipos.some((t) => filtros.tipo?.includes(t.valor as never))
  }

  function handleQuartos(q: number) {
    onChange({ ...filtros, quartos_min: filtros.quartos_min === q ? undefined : q })
  }

  function limparFiltros() {
    onChange({})
    setModalAberto(null)
  }

  const temFiltrosAtivos = !!(
    filtros.negociacao ||
    (filtros.tipo && filtros.tipo.length) ||
    filtros.preco_min ||
    filtros.preco_max ||
    filtros.quartos_min
  )

  function handleLocalSelecionado(s: Sugestao) {
    // Atualiza o filtro de cidade com o nome selecionado
    onChange({ ...filtros, cidade: s.nome })
    // Passa as coordenadas para o mapa voar até lá
    onLocalSelecionado?.(s)
  }

  function handleLocalLimpar() {
    onChange({ ...filtros, cidade: undefined })
  }

  return (
    <div className={styles.wrapper}>

      {/* Botão voltar à home */}
      <Link href="/" className={styles.btnVoltar} title="Voltar ao início">
        ←
      </Link>

      {/* Badge de modo: Compra ou Aluguel */}
      <Link
        href="/"
        className={`${styles.badgeModo} ${filtros.negociacao === 'aluguel' ? styles.badgeAluguel : styles.badgeCompra}`}
        title="Clique para voltar e trocar o modo"
      >
        {filtros.negociacao === 'aluguel' ? '🔑 Aluguel' : '🏠 Compra'}
      </Link>

      {/* Autocomplete por cidade/bairro via Mapbox Geocoding */}
      <BuscaAutoComplete
        placeholder="Cidade, bairro ou região..."
        valorInicial={filtros.cidade}
        onSelecionada={handleLocalSelecionado}
        onLimpar={handleLocalLimpar}
      />

      {/* Filtro: Tipo — botão único abre dropdown 3 colunas */}
      <button
        ref={btnTipoRef}
        className={`${styles.btnFiltro} ${filtros.tipo?.length ? styles.ativo : ''}`}
        onClick={abrirTipo}
      >
        Tipo {filtros.tipo?.length ? `(${filtros.tipo.length})` : ''}
        <span className={styles.setinha}>▾</span>
      </button>

      {/* Dropdown de tipos — 3 colunas, fixed */}
      {modalAberto === 'tipo' && (
        <div
          ref={dropTipoRef}
          className={styles.dropdown}
          style={{ top: dropPos.top, left: dropPos.left }}
        >
          <div className={styles.dropdownTresColunas}>
            {GRUPOS_TIPO.map((g, gi) => {
              const classeGrupo = g.grupo === 'Residencial'
                ? styles.grupoResidencial
                : g.grupo === 'Comercial'
                  ? styles.grupoComercial
                  : styles.grupoRural
              return (
                <div key={g.grupo} style={{ display: 'contents' }}>
                  {gi > 0 && <div className={styles.divisorVertical} />}
                  <div className={`${styles.colunaGrupo} ${classeGrupo}`}>
                    <p className={styles.labelGrupo}>{g.icone} {g.grupo}</p>
                    <div className={styles.dropdownGrid}>
                      {g.tipos.map((t) => (
                        <button
                          key={t.valor}
                          className={`${styles.chipTipo} ${filtros.tipo?.includes(t.valor as never) ? styles.chipAtivo : ''}`}
                          onClick={() => toggleTipo(t.valor)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className={styles.dropdownFooter}>
            <button className={styles.btnAplicar} onClick={() => setModalAberto(null)}>
              ✕ Fechar
            </button>
          </div>
        </div>
      )}

      {/* Filtro: Preço */}
      <div className={styles.filtroRelativo}>
        <button
          className={`${styles.btnFiltro} ${(filtros.preco_min || filtros.preco_max) ? styles.ativo : ''}`}
          onClick={() => setModalAberto(modalAberto === 'preco' ? null : 'preco')}
        >
          Preço
          <span className={styles.setinha}>▾</span>
        </button>

        {modalAberto === 'preco' && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownPreco}>
              <div className={styles.campoPreco}>
                <label>Mínimo (R$)</label>
                <input
                  type="number"
                  className="campo"
                  placeholder="Sem mínimo"
                  value={filtros.preco_min ?? ''}
                  onChange={(e) => onChange({ ...filtros, preco_min: Number(e.target.value) || undefined })}
                />
              </div>
              <div className={styles.campoPreco}>
                <label>Máximo (R$)</label>
                <input
                  type="number"
                  className="campo"
                  placeholder="Sem máximo"
                  value={filtros.preco_max ?? ''}
                  onChange={(e) => onChange({ ...filtros, preco_max: Number(e.target.value) || undefined })}
                />
              </div>
            </div>
            <button className={styles.btnAplicar} onClick={() => setModalAberto(null)}>
              ? Fechar
            </button>
          </div>
        )}
      </div>

      {/* Filtro: Quartos */}
      <div className={styles.filtroRelativo}>
        <button
          className={`${styles.btnFiltro} ${filtros.quartos_min ? styles.ativo : ''}`}
          onClick={() => setModalAberto(modalAberto === 'quartos' ? null : 'quartos')}
        >
          Quartos {filtros.quartos_min ? `${filtros.quartos_min}+` : ''}
          <span className={styles.setinha}>▾</span>
        </button>

        {modalAberto === 'quartos' && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownQuartos}>
              {QUARTOS.map((q) => (
                <button
                  key={q}
                  className={`${styles.chipQuarto} ${filtros.quartos_min === q ? styles.chipAtivo : ''}`}
                  onClick={() => handleQuartos(q)}
                >
                  {q}+
                </button>
              ))}
            </div>
            <button className={styles.btnAplicar} onClick={() => setModalAberto(null)}>
              ? Fechar
            </button>
          </div>
        )}
      </div>

      {/* Limpar filtros */}
      {temFiltrosAtivos && (
        <button className={styles.btnLimpar} onClick={limparFiltros}>
          ✕ Limpar
        </button>
      )}

      {/* Fechar dropdowns ao clicar fora */}
      {modalAberto && (
        <div className={styles.overlay} onClick={() => setModalAberto(null)} />
      )}
    </div>
  )
}
