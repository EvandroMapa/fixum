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

const QUARTOS = [1, 2, 3, 4, 5]

export default function FiltrosBusca({ filtros, onChange, onLocalSelecionado }: Props) {
  const [modalAberto, setModalAberto] = useState<string | null>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const btnTipoRef = useRef<HTMLButtonElement>(null)
  const dropTipoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fecha dropdown no desktop ao clicar fora
  useEffect(() => {
    if (isMobile) return
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
  }, [isMobile])

  // Bloqueia scroll do body no mobile quando o drawer estiver aberto
  useEffect(() => {
    if (isMobile && modalAberto) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, modalAberto])

  function abrirTipo() {
    if (!isMobile && btnTipoRef.current) {
      const rect = btnTipoRef.current.getBoundingClientRect()
      const dropW = 560
      const left = Math.min(rect.left, window.innerWidth - dropW - 8)
      setDropPos({ top: rect.bottom + 8, left: Math.max(8, left) })
    }
    setModalAberto((v) => v === 'tipo' ? null : 'tipo')
  }

  function handleNegociacao(neg: TipoNegociacao) {
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

  function toggleCategoria(grupo: typeof GRUPOS_TIPO[0]) {
    const valoresGrupo = grupo.tipos.map((t) => t.valor)
    const atual = filtros.tipo ?? []
    const todosAtivos = valoresGrupo.every((v) => atual.includes(v as never))
    if (todosAtivos) {
      const novo = atual.filter((t) => !valoresGrupo.includes(t as string))
      onChange({ ...filtros, tipo: novo.length ? novo : undefined })
    } else {
      const novo = [...new Set([...atual, ...valoresGrupo])] as never[]
      onChange({ ...filtros, tipo: novo })
    }
  }

  function getCategoriaStatus(grupo: typeof GRUPOS_TIPO[0]) {
    const valoresGrupo = grupo.tipos.map((t) => t.valor)
    const atual = filtros.tipo ?? []
    const ativosCount = valoresGrupo.filter((v) => atual.includes(v as never)).length
    const todosAtivos = ativosCount === valoresGrupo.length && valoresGrupo.length > 0
    return { ativosCount, todosAtivos, algumAtivo: ativosCount > 0 }
  }

  function handleQuartos(q: number) {
    onChange({ ...filtros, quartos_min: filtros.quartos_min === q ? undefined : q })
  }

  function limparFiltros() {
    onChange({})
    setModalAberto(null)
  }

  const temFiltrosAtivos = !!(
    (filtros.tipo && filtros.tipo.length) ||
    filtros.preco_min ||
    filtros.preco_max ||
    filtros.quartos_min
  )

  const contagemFiltros = (
    (filtros.tipo?.length ? 1 : 0) +
    (filtros.preco_min || filtros.preco_max ? 1 : 0) +
    (filtros.quartos_min ? 1 : 0)
  )

  function handleLocalSelecionado(s: Sugestao) {
    onChange({ ...filtros, cidade: s.nome })
    onLocalSelecionado?.(s)
  }

  function handleLocalLimpar() {
    onChange({ ...filtros, cidade: undefined })
  }

  // Label amigável de preço para chip
  const precoChipLabel = (() => {
    if (filtros.preco_min && filtros.preco_max) {
      return `R$ ${filtros.preco_min / 1000}k - ${filtros.preco_max / 1000}k`
    }
    if (filtros.preco_min) return `A partir de R$ ${filtros.preco_min / 1000}k`
    if (filtros.preco_max) return `Até R$ ${filtros.preco_max / 1000}k`
    return 'Preço'
  })()

  // Conteúdo dos Grupos de Tipos (Reutilizável)
  const conteudoTipos = (
    <div className={styles.dropdownTresColunas}>
      {GRUPOS_TIPO.map((g, gi) => {
        const classeGrupo = g.grupo === 'Residencial'
          ? styles.grupoResidencial
          : g.grupo === 'Comercial'
            ? styles.grupoComercial
            : styles.grupoRural
        const status = getCategoriaStatus(g)
        return (
          <div key={g.grupo} className={styles.grupoWrapperItem}>
            {gi > 0 && <div className={styles.divisorVertical} />}
            <div className={`${styles.colunaGrupo} ${classeGrupo}`}>
              <div className={styles.headerGrupo}>
                <span className={styles.labelGrupo}>{g.icone} {g.grupo}</span>
                <button
                  type="button"
                  className={`${styles.btnToggleTodos} ${status.todosAtivos ? styles.todosAtivos : ''}`}
                  onClick={() => toggleCategoria(g)}
                  title={status.todosAtivos ? `Desmarcar todos de ${g.grupo}` : `Marcar todos de ${g.grupo}`}
                >
                  {status.todosAtivos ? '✓ Todos' : '+ Marcar todos'}
                </button>
              </div>
              <div className={styles.dropdownGrid}>
                {g.tipos.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
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
  )

  // Conteúdo dos Preços (Reutilizável)
  const conteudoPreco = (
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
  )

  // Conteúdo dos Quartos (Reutilizável)
  const conteudoQuartos = (
    <div className={styles.dropdownQuartos}>
      {QUARTOS.map((q) => (
        <button
          key={q}
          type="button"
          className={`${styles.chipQuarto} ${filtros.quartos_min === q ? styles.chipAtivo : ''}`}
          onClick={() => handleQuartos(q)}
        >
          {q}+
        </button>
      ))}
    </div>
  )

  return (
    <div className={styles.wrapperPrincipal}>
      {/* ── LINHA 1 MOBILE / PRINCIPAL DESKTOP ── */}
      <div className={styles.linhaBusca}>
        {/* Botão voltar à home */}
        <Link href="/" className={styles.btnVoltar} title="Voltar ao início">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </Link>

        {/* Badge de modo Desktop: Compra ou Aluguel */}
        <Link
          href="/"
          className={`${styles.badgeModoDesktop} ${filtros.negociacao === 'aluguel' ? styles.badgeAluguel : styles.badgeCompra}`}
          title="Clique para voltar e trocar o modo"
        >
          {filtros.negociacao === 'aluguel' ? '🔑 Aluguel' : '🏠 Compra'}
        </Link>

        {/* Autocomplete por cidade/bairro */}
        <div className={styles.autocompleteContainer}>
          <BuscaAutoComplete
            placeholder="Cidade, bairro ou região..."
            valorInicial={filtros.cidade}
            onSelecionada={handleLocalSelecionado}
            onLimpar={handleLocalLimpar}
          />
        </div>

        {/* Botão Filtros Gerais Mobile */}
        <button
          type="button"
          className={`${styles.btnFiltrosMobile} ${temFiltrosAtivos ? styles.btnFiltrosMobileAtivo : ''}`}
          onClick={() => setModalAberto('todos')}
          aria-label="Abrir filtros"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>
          </svg>
          {contagemFiltros > 0 && (
            <span className={styles.badgeQtdFiltros}>{contagemFiltros}</span>
          )}
        </button>

        {/* ── FILTROS DESKTOP ── */}
        <div className={styles.filtrosDesktop}>
          {/* Filtro: Tipo */}
          <div className={styles.filtroRelativo}>
            <button
              ref={btnTipoRef}
              className={`${styles.btnFiltro} ${filtros.tipo?.length ? styles.ativo : ''}`}
              onClick={abrirTipo}
            >
              Tipo {filtros.tipo?.length ? `(${filtros.tipo.length})` : ''}
              <span className={styles.setinha}>▾</span>
            </button>

            {modalAberto === 'tipo' && !isMobile && (
              <div
                ref={dropTipoRef}
                className={styles.dropdown}
                style={{ top: dropPos.top, left: dropPos.left }}
              >
                {conteudoTipos}
                <div className={styles.dropdownFooter}>
                  <button className={styles.btnAplicar} onClick={() => setModalAberto(null)}>
                    ✕ Fechar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Filtro: Preço */}
          <div className={styles.filtroRelativo}>
            <button
              className={`${styles.btnFiltro} ${(filtros.preco_min || filtros.preco_max) ? styles.ativo : ''}`}
              onClick={() => setModalAberto(modalAberto === 'preco' ? null : 'preco')}
            >
              {precoChipLabel}
              <span className={styles.setinha}>▾</span>
            </button>

            {modalAberto === 'preco' && !isMobile && (
              <div className={styles.dropdown}>
                {conteudoPreco}
                <button className={styles.btnAplicar} onClick={() => setModalAberto(null)}>
                  ✕ Fechar
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

            {modalAberto === 'quartos' && !isMobile && (
              <div className={styles.dropdown}>
                {conteudoQuartos}
                <button className={styles.btnAplicar} onClick={() => setModalAberto(null)}>
                  ✕ Fechar
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
        </div>
      </div>

      {/* ── LINHA 2 MOBILE: CHIPS HORIZONTAIS COM TOUCH SCROLL ── */}
      <div className={styles.linhaChipsMobile}>
        {/* Toggle Venda / Aluguel Rápido */}
        <button
          type="button"
          className={`${styles.chipMobile} ${filtros.negociacao === 'aluguel' ? styles.chipAluguel : styles.chipCompra}`}
          onClick={() => handleNegociacao(filtros.negociacao === 'aluguel' ? 'venda' : 'aluguel')}
        >
          {filtros.negociacao === 'aluguel' ? '🔑 Aluguel' : '🏠 Compra'}
          <span className={styles.chipTrocaModo}>⇄</span>
        </button>

        {/* Chip Tipo */}
        <button
          type="button"
          className={`${styles.chipMobile} ${filtros.tipo?.length ? styles.chipMobileAtivo : ''}`}
          onClick={() => setModalAberto('tipo')}
        >
          <span>Tipo {filtros.tipo?.length ? `(${filtros.tipo.length})` : ''}</span>
          <span className={styles.setinha}>▾</span>
        </button>

        {/* Chip Preço */}
        <button
          type="button"
          className={`${styles.chipMobile} ${(filtros.preco_min || filtros.preco_max) ? styles.chipMobileAtivo : ''}`}
          onClick={() => setModalAberto('preco')}
        >
          <span>{precoChipLabel}</span>
          <span className={styles.setinha}>▾</span>
        </button>

        {/* Chip Quartos */}
        <button
          type="button"
          className={`${styles.chipMobile} ${filtros.quartos_min ? styles.chipMobileAtivo : ''}`}
          onClick={() => setModalAberto('quartos')}
        >
          <span>{filtros.quartos_min ? `${filtros.quartos_min}+ quartos` : 'Quartos'}</span>
          <span className={styles.setinha}>▾</span>
        </button>

        {/* Chip Limpar */}
        {temFiltrosAtivos && (
          <button type="button" className={styles.chipLimparMobile} onClick={limparFiltros}>
            ✕ Limpar
          </button>
        )}
      </div>

      {/* ── MODAL / BOTTOM SHEET MOBILE ── */}
      {modalAberto && isMobile && (
        <div className={styles.drawerOverlay} onClick={() => setModalAberto(null)}>
          <div className={styles.drawerContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHandle} />
            <div className={styles.drawerHeader}>
              <h3 className={styles.drawerTitulo}>
                {modalAberto === 'tipo' && 'Selecionar Tipo de Imóvel'}
                {modalAberto === 'preco' && 'Faixa de Preço'}
                {modalAberto === 'quartos' && 'Quantidade de Quartos'}
                {modalAberto === 'todos' && 'Filtros de Busca'}
              </h3>
              <button
                type="button"
                className={styles.drawerBtnFechar}
                onClick={() => setModalAberto(null)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className={styles.drawerCorpo}>
              {/* Seção de Negociação se for 'todos' */}
              {modalAberto === 'todos' && (
                <div className={styles.drawerSecao}>
                  <span className={styles.drawerSecaoTitulo}>Negociação</span>
                  <div className={styles.drawerToggleNegociacao}>
                    <button
                      type="button"
                      className={`${styles.btnToggleNeg} ${filtros.negociacao !== 'aluguel' ? styles.btnToggleNegAtivo : ''}`}
                      onClick={() => handleNegociacao('venda')}
                    >
                      🏠 Comprar
                    </button>
                    <button
                      type="button"
                      className={`${styles.btnToggleNeg} ${filtros.negociacao === 'aluguel' ? styles.btnToggleNegAtivo : ''}`}
                      onClick={() => handleNegociacao('aluguel')}
                    >
                      🔑 Alugar
                    </button>
                  </div>
                </div>
              )}

              {/* Seção Tipos */}
              {(modalAberto === 'tipo' || modalAberto === 'todos') && (
                <div className={styles.drawerSecao}>
                  {modalAberto === 'todos' && (
                    <span className={styles.drawerSecaoTitulo}>Tipo de Imóvel</span>
                  )}
                  {conteudoTipos}
                </div>
              )}

              {/* Seção Preço */}
              {(modalAberto === 'preco' || modalAberto === 'todos') && (
                <div className={styles.drawerSecao}>
                  {modalAberto === 'todos' && (
                    <span className={styles.drawerSecaoTitulo}>Preço</span>
                  )}
                  {conteudoPreco}
                </div>
              )}

              {/* Seção Quartos */}
              {(modalAberto === 'quartos' || modalAberto === 'todos') && (
                <div className={styles.drawerSecao}>
                  {modalAberto === 'todos' && (
                    <span className={styles.drawerSecaoTitulo}>Quartos</span>
                  )}
                  {conteudoQuartos}
                </div>
              )}
            </div>

            <div className={styles.drawerFooter}>
              {temFiltrosAtivos && (
                <button
                  type="button"
                  className={styles.drawerBtnLimpar}
                  onClick={limparFiltros}
                >
                  Limpar
                </button>
              )}
              <button
                type="button"
                className={styles.drawerBtnAplicar}
                onClick={() => setModalAberto(null)}
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay Desktop */}
      {modalAberto && !isMobile && (
        <div className={styles.overlay} onClick={() => setModalAberto(null)} />
      )}
    </div>
  )
}

