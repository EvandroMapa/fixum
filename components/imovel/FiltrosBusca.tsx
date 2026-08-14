'use client'

import { useState } from 'react'
import { type FiltrosBusca, type TipoNegociacao } from '@/lib/types'
import styles from './FiltrosBusca.module.css'

interface Props {
  filtros: FiltrosBusca
  onChange: (filtros: FiltrosBusca) => void
}

const TIPOS = [
  { valor: 'casa', label: 'Casa' },
  { valor: 'apartamento', label: 'Apartamento' },
  { valor: 'terreno', label: 'Terreno' },
  { valor: 'sala_comercial', label: 'Comercial' },
  { valor: 'sitio', label: 'Sítio' },
  { valor: 'chacara', label: 'Chácara' },
  { valor: 'fazenda', label: 'Fazenda' },
  { valor: 'outro', label: 'Outro' },
]

const QUARTOS = [1, 2, 3, 4, 5]

export default function FiltrosBusca({ filtros, onChange }: Props) {
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

  return (
    <div className={styles.wrapper}>
      {/* Busca por cidade */}
      <div className={styles.campoCidade}>
        <span>📍</span>
        <input
          type="text"
          placeholder="Cidade ou bairro..."
          value={filtros.cidade ?? ''}
          onChange={(e) => onChange({ ...filtros, cidade: e.target.value || undefined })}
          className={styles.inputCidade}
        />
      </div>

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
