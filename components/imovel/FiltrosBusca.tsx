'use client'

import { useState } from 'react'
import { type FiltrosBusca, type TipoNegociacao } from '@/lib/types'
import BuscaAutoComplete, { type Sugestao } from './BuscaAutoComplete'
import styles from './FiltrosBusca.module.css'

interface Props {
  filtros: FiltrosBusca
  onChange: (filtros: FiltrosBusca) => void
  onLocalSelecionado?: (sugestao: Sugestao) => void
}

const TIPOS = [
  // Residencial
  { valor: 'apartamento',     label: 'Apartamento' },
  { valor: 'casa',            label: 'Casa' },
  { valor: 'sobrado',         label: 'Sobrado' },
  { valor: 'casa_condominio', label: 'Casa em Condomínio' },
  { valor: 'cobertura',       label: 'Cobertura' },
  { valor: 'kitnet',          label: 'Kitnet / Studio' },
  { valor: 'flat',            label: 'Flat' },
  { valor: 'lote',            label: 'Lote' },
  // Comercial
  { valor: 'sala_comercial',  label: 'Sala Comercial' },
  { valor: 'loja',            label: 'Loja / Ponto Comercial' },
  { valor: 'galpao',          label: 'Galpão' },
  { valor: 'predio',          label: 'Prédio Comercial' },
  { valor: 'garagem',         label: 'Garagem' },
  { valor: 'terreno_comercial', label: 'Terreno / Lote' },
  // Rural
  { valor: 'sitio',           label: 'Sítio' },
  { valor: 'chacara',         label: 'Chácara' },
  { valor: 'fazenda',         label: 'Fazenda' },
  { valor: 'rancho',          label: 'Rancho' },
  // Geral
  { valor: 'outro',           label: 'Outro' },
]

const QUARTOS = [1, 2, 3, 4, 5]

export default function FiltrosBusca({ filtros, onChange, onLocalSelecionado }: Props) {
  const [modalAberto, setModalAberto] = useState<string | null>(null)

  function handleNegociacao(neg: TipoNegociacao | undefined) {
    onChange({ ...filtros, negociacao: neg })
  }

  function toggleTipo(tipo: string) {
    const atual = filtros.tipo ?? []
    const novo = atual.includes(tipo as never)
      ? atual.filter((t) => t !== tipo)
      : [...atual, tipo as never]
    onChange({ ...filtros, tipo: novo.length ? novo : undefined })
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
      {/* Autocomplete por cidade/bairro via Mapbox Geocoding */}
      <BuscaAutoComplete
        placeholder="Cidade, bairro ou região..."
        valorInicial={filtros.cidade}
        onSelecionada={handleLocalSelecionado}
        onLimpar={handleLocalLimpar}
      />

      {/* Filtro: Negociação */}
      <div className={styles.grupoFiltro}>
        <button
          className={`${styles.btnFiltro} ${filtros.negociacao === 'venda' ? styles.ativo : ''}`}
          onClick={() => handleNegociacao(filtros.negociacao === 'venda' ? undefined : 'venda')}
        >
          Comprar
        </button>
        <button
          className={`${styles.btnFiltro} ${filtros.negociacao === 'aluguel' ? styles.ativo : ''}`}
          onClick={() => handleNegociacao(filtros.negociacao === 'aluguel' ? undefined : 'aluguel')}
        >
          Alugar
        </button>
      </div>

      {/* Filtro: Tipo */}
      <div className={styles.filtroRelativo}>
        <button
          className={`${styles.btnFiltro} ${filtros.tipo?.length ? styles.ativo : ''}`}
          onClick={() => setModalAberto(modalAberto === 'tipo' ? null : 'tipo')}
        >
          Tipo {filtros.tipo?.length ? `(${filtros.tipo.length})` : ''}
          <span className={styles.setinha}>▾</span>
        </button>

        {modalAberto === 'tipo' && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownGrid}>
              {TIPOS.map((t) => (
                <button
                  key={t.valor}
                  className={`${styles.chipTipo} ${filtros.tipo?.includes(t.valor as never) ? styles.chipAtivo : ''}`}
                  onClick={() => toggleTipo(t.valor)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button className={styles.btnAplicar} onClick={() => setModalAberto(null)}>
              Aplicar
            </button>
          </div>
        )}
      </div>

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
              Aplicar
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
              Aplicar
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
