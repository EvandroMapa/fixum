'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import {
  PLANOS_OFICIAIS,
  formatarMoeda,
  obterPlanoNecessario,
  calcularPrecoPeriodicidade,
  calcularCustoUnitario,
} from '@/lib/planos'
import { PeriodicidadePlano } from '@/lib/types'
import styles from './page.module.css'

export default function PlanosPage() {
  const [qtdImoveisSimulador, setQtdImoveisSimulador] = useState<number>(1)
  const [periodicidade, setPeriodicidade] = useState<PeriodicidadePlano>('mensal')

  const planoSugerido = obterPlanoNecessario(qtdImoveisSimulador)
  const detalhesSugerido = calcularPrecoPeriodicidade(planoSugerido.preco_mensal, periodicidade)

  const faixasRapidas = [1, 2, 3, 10, 20, 50, 100, 200, 500]

  return (
    <>
      <Header />
      <div className={styles.pagina}>
        {/* ── HERO SECTION ── */}
        <section className={styles.hero}>
          <div className={styles.container}>
            <span className={styles.heroBadge}>Planos & Assinaturas</span>
            <h1 className={styles.heroTitulo}>
              Anuncie seus imóveis na Fixum.<br />
              <span className={styles.gradiente}>Comece grátis.</span>
            </h1>
            <p className={styles.heroSubtitulo}>
              Escolha o plano de acordo com o tamanho da sua carteira. Sem taxas ocultas, sem comissões sobre negociações.
              Quanto mais imóveis você anuncia, menor é o custo por imóvel.
            </p>

            <div className={styles.heroAcoes}>
              <Link href="/cadastro" className="btn btn-primario btn-lg">
                Começar Grátis com 1 Imóvel
              </Link>
              <a href="#simulador" className="btn btn-outline btn-lg">
                Simular Minha Carteira
              </a>
            </div>

            {/* Banner Especial para Imobiliárias */}
            <div style={{
              maxWidth: '680px',
              margin: '2rem auto 0',
              padding: '1rem 1.5rem',
              background: '#ffffff',
              border: '2px solid #bfdbfe',
              borderRadius: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              boxShadow: '0 4px 6px -1px rgba(15, 76, 129, 0.08)',
              flexWrap: 'wrap',
              textAlign: 'left'
            }}>
              <div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🏢</span> Representa uma Imobiliária ou Rede?
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                  Condições especiais para +50 imóveis, múltiplos corretores e menor custo.
                </div>
              </div>
              <Link
                href="/para-imobiliarias"
                className="btn btn-primario btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                Ver Planos para Imobiliárias →
              </Link>
            </div>
          </div>
        </section>

        {/* ── SIMULADOR DE PLANO IDEAL ── */}
        <section id="simulador" className={styles.secaoSimulador}>
          <div className={styles.container}>
            <div className={styles.cardSimulador}>
              <div className={styles.simuladorHeader}>
                <h2>Quantos imóveis você deseja manter ativos?</h2>
                <p>Arraste ou selecione a quantidade para descobrir o plano mais econômico</p>
              </div>

              <div className={styles.botoesFaixas}>
                {faixasRapidas.map((qtd) => (
                  <button
                    key={qtd}
                    type="button"
                    className={`${styles.btnFaixa} ${qtdImoveisSimulador === qtd ? styles.btnFaixaAtivo : ''}`}
                    onClick={() => setQtdImoveisSimulador(qtd)}
                  >
                    {qtd} {qtd === 1 ? 'imóvel' : 'imóveis'}
                  </button>
                ))}
              </div>

              <div className={styles.sliderWrapper}>
                <input
                  type="range"
                  min="1"
                  max="500"
                  value={qtdImoveisSimulador}
                  onChange={(e) => setQtdImoveisSimulador(parseInt(e.target.value))}
                  className={styles.rangeInput}
                />
                <div className={styles.rangeLabels}>
                  <span>1 imóvel</span>
                  <span>100</span>
                  <span>250</span>
                  <span>500+ imóveis</span>
                </div>
              </div>

              {/* Resultado do Simulador */}
              <div className={styles.resultadoSimulador}>
                <div className={styles.resultadoInfo}>
                  <span className={styles.tagResultado}>Plano Recomendado</span>
                  <h3>{planoSugerido.nome}</h3>
                  <p>
                    Comporta até <strong>{planoSugerido.limite_imoveis_max >= 99999 ? '+500' : planoSugerido.limite_imoveis_max} imóveis ativos</strong> simultâneos.
                  </p>
                </div>

                <div className={styles.resultadoPreco}>
                  {planoSugerido.id === 'enterprise_plus' ? (
                    <span className={styles.precoConsulta}>Sob consulta</span>
                  ) : (
                    <>
                      <div className={styles.precoMensalidade}>
                        <strong>{formatarMoeda(planoSugerido.preco_mensal)}</strong>
                        {planoSugerido.preco_mensal > 0 && <small>/mês</small>}
                      </div>
                      {planoSugerido.custo_unitario_max > 0 && (
                        <span className={styles.custoUnitarioBadge}>
                          Apenas {formatarMoeda(planoSugerido.custo_unitario_max)} / imóvel / mês
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className={styles.resultadoAcao}>
                  <Link
                    href={planoSugerido.id === 'gratis' ? '/cadastro' : '/cadastro?plano=' + planoSugerido.id}
                    className="btn btn-primario"
                  >
                    {planoSugerido.id === 'gratis' ? 'Cadastrar Grátis' : `Contratar ${planoSugerido.nome}`}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TABELA OFICIAL DE TODOS OS PLANOS ── */}
        <section className={styles.secaoPlanos}>
          <div className={styles.container}>
            <div className={styles.secaoHeaderCentral}>
              <h2>Tabela Oficial de Planos</h2>
              <p>Transparência total: escolha o plano sob medida para sua estratégia de vendas</p>
            </div>

            {/* SELETOR DE PERIODICIDADE */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '6px',
              margin: '1.5rem auto 2.5rem',
              background: '#f1f5f9',
              padding: '6px',
              borderRadius: '12px',
              maxWidth: '520px',
              flexWrap: 'wrap',
            }}>
              {[
                { id: 'mensal', label: 'Mensal', tag: null },
                { id: 'trimestral', label: '3 Meses', tag: '-10% OFF' },
                { id: 'semestral', label: '6 Meses', tag: '-15% OFF' },
                { id: 'anual', label: '1 Ano 🔥', tag: '-20% OFF' },
              ].map((c) => {
                const isAtivo = periodicidade === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setPeriodicidade(c.id as any)}
                    style={{
                      background: isAtivo ? '#0f4c81' : 'transparent',
                      color: isAtivo ? '#ffffff' : '#475569',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '0.85rem',
                      fontWeight: isAtivo ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>{c.label}</span>
                    {c.tag && (
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        background: isAtivo ? 'rgba(255,255,255,0.25)' : '#ecfdf5',
                        color: isAtivo ? '#ffffff' : '#059669',
                        padding: '1px 6px',
                        borderRadius: '10px',
                      }}>
                        {c.tag}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className={styles.gridPlanosOficiais}>
              {PLANOS_OFICIAIS.map((p) => {
                const isDestaque = p.id === 'profissional'
                const isGratis = p.id === 'gratis'
                const detalhes = calcularPrecoPeriodicidade(p.preco_mensal, periodicidade)

                return (
                  <div
                    key={p.id}
                    className={`
                      ${styles.cardPlano}
                      ${isDestaque ? styles.cardPlanoDestaque : ''}
                      ${isGratis ? styles.cardPlanoGratis : ''}
                    `}
                  >
                    {isDestaque && <span className={styles.badgePopular}>Mais Popular</span>}
                    {isGratis && <span className={styles.badgeGratis}>Entrada Livre</span>}

                    <h3 className={styles.cardPlanoTitulo}>{p.nome}</h3>
                    <p className={styles.cardPlanoDescricao}>{p.descricao}</p>

                    <div className={styles.cardPlanoCapacidadeBox}>
                      <span className={styles.capacidadeNumero}>
                        {p.limite_imoveis_max >= 99999 ? '+500' : p.limite_imoveis_max}
                      </span>
                      <span className={styles.capacidadeTexto}>
                        {p.limite_imoveis_max === 1 ? 'imóvel ativo' : 'imóveis ativos'}
                      </span>
                    </div>

                    <div className={styles.cardPlanoPrecoBox}>
                      {p.id === 'enterprise_plus' ? (
                        <span className={styles.precoSobConsulta}>Sob consulta</span>
                      ) : (
                        <>
                          <span className={styles.precoSimbolo}>R$</span>
                          <span className={styles.precoValor}>
                            {detalhes.valorMensalEquivalente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          {p.preco_mensal > 0 && <span className={styles.precoPeriodo}>/mês</span>}
                        </>
                      )}
                    </div>

                    {detalhes.descontoPct > 0 && p.preco_mensal > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginBottom: '8px' }}>
                        🎉 {detalhes.descontoPct}% OFF (Total: {formatarMoeda(detalhes.valorTotalComDesconto)})
                      </div>
                    )}

                    {p.custo_unitario_max > 0 && (() => {
                      const custoUnitario = calcularCustoUnitario(p.preco_mensal, p.limite_imoveis_max, periodicidade)
                      return (
                        <div className={styles.cardPlanoCustoUnitario}>
                          Custo efetivo: <strong style={{ color: detalhes.descontoPct > 0 ? '#059669' : 'inherit' }}>{formatarMoeda(custoUnitario)}</strong> / imóvel / mês
                        </div>
                      )
                    })()}

                    <ul className={styles.listaRecursos}>
                      <li>✓ Mapa interativo e busca georreferenciada</li>
                      <li>✓ Fotos ilimitadas em alta resolução</li>
                      <li>✓ Recebimento de contatos direto no WhatsApp</li>
                      <li>✓ Painel de gestão e edição de anúncios</li>
                      <li>✓ Flexibilidade para pausar e reativar imóveis</li>
                    </ul>

                    <div className={styles.cardPlanoBtnWrapper}>
                      <Link
                        href={isGratis ? '/cadastro' : `/cadastro?plano=${p.id}&ciclo=${periodicidade}`}
                        className={`btn ${isDestaque ? 'btn-primario' : 'btn-outline'} ${styles.btnCardPlano}`}
                      >
                        {isGratis ? 'Começar Grátis' : `Contratar ${p.nome}`}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── TABELA COMPARATIVA DE CUSTO POR IMÓVEL ── */}
        <section className={styles.secaoComparativo}>
          <div className={styles.container}>
            <div className={styles.secaoHeaderCentral}>
              <h2>Custo Efetivo por Imóvel</h2>
              <p>Veja como o custo unitário cai progressivamente à medida que sua carteira cresce</p>
            </div>

            <div className={styles.tabelaWrapper}>
              <table className={styles.tabelaComparativa}>
                <thead>
                  <tr>
                    <th>Plano</th>
                    <th>Imóveis Ativos</th>
                    <th>Mensalidade</th>
                    <th>Custo Máximo por Imóvel</th>
                    <th>Economia</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANOS_OFICIAIS.filter(p => p.id !== 'enterprise_plus').map((p, index) => (
                    <tr key={p.id} className={p.id === 'profissional' ? styles.linhaDestacada : ''}>
                      <td><strong>{p.nome}</strong></td>
                      <td>Até {p.limite_imoveis_max} {p.limite_imoveis_max === 1 ? 'imóvel' : 'imóveis'}</td>
                      <td><strong>{formatarMoeda(p.preco_mensal)}/mês</strong></td>
                      <td className={styles.colCustoUnitario}>
                        <span className={styles.badgeCusto}>{formatarMoeda(p.custo_unitario_max)}</span>
                      </td>
                      <td className={styles.colEconomia}>
                        {index > 1 ? `${Math.round((1 - (p.custo_unitario_max / 7.45)) * 100)}% de economia` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── POR QUE ANUNCIAR NA FIXUM ── */}
        <section className={styles.secaoVantagens}>
          <div className={styles.container}>
            <div className={styles.secaoHeaderCentral}>
              <h2>Por que escolher a Fixum?</h2>
              <p>O jeito mais inteligente e moderno de expor imóveis pelo mapa</p>
            </div>

            <div className={styles.gridVantagens}>
              <div className={styles.cardVantagem}>
                <span className={styles.iconeVantagem}>🎯</span>
                <h3>0% de Comissão</h3>
                <p>
                  A Fixum cobra apenas pela utilização da plataforma. Toda a comissão da venda ou aluguel é 100% sua.
                </p>
              </div>

              <div className={styles.cardVantagem}>
                <span className={styles.iconeVantagem}>🗺️</span>
                <h3>Descoberta Visual no Mapa</h3>
                <p>
                  Compradores e locatários encontram seus imóveis navegando pelo mapa com alta precisão e fluidez.
                </p>
              </div>

              <div className={styles.cardVantagem}>
                <span className={styles.iconeVantagem}>⏸️</span>
                <h3>Pausa Inteligente de Anúncios</h3>
                <p>
                  Imóveis pausados não consomem sua cota do plano. Pause e reative seus anúncios conforme o estoque gira.
                </p>
              </div>

              <div className={styles.cardVantagem}>
                <span className={styles.iconeVantagem}>💬</span>
                <h3>Leads Diretos no WhatsApp</h3>
                <p>
                  Interessados entram em contato diretamente com você via WhatsApp e ficam salvos no seu painel.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className={styles.secaoFaqPublico}>
          <div className={styles.container}>
            <div className={styles.secaoHeaderCentral}>
              <h2>Perguntas Frequentes</h2>
              <p>Tudo o que você precisa saber sobre o funcionamento dos planos</p>
            </div>

            <div className={styles.gridFaqPublico}>
              <div className={styles.faqCard}>
                <h4>O plano grátis é por tempo limitado?</h4>
                <p>
                  Não! O plano gratuito permite anunciar 1 imóvel ativo sem nenhum custo e sem prazo de validade.
                </p>
              </div>

              <div className={styles.faqCard}>
                <h4>O que acontece se eu pausar um imóvel?</h4>
                <p>
                  Imóveis pausados liberam espaço imediatamente no seu plano para que você publique outro anúncio. Seus dados e fotos ficam salvos intactos.
                </p>
              </div>

              <div className={styles.faqCard}>
                <h4>Como funciona a troca ou upgrade de plano?</h4>
                <p>
                  Você pode fazer o upgrade a qualquer momento pelo painel. O novo limite de capacidade é liberado instantaneamente.
                </p>
              </div>

              <div className={styles.faqCard}>
                <h4>Posso cancelar quando quiser?</h4>
                <p>
                  Sim. Não há fidelidade ou contratos de longo prazo. Você pode cancelar sua assinatura diretamente pelo painel e continuar usando até o final do período pago.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className={styles.ctaFinal}>
          <div className={styles.container}>
            <div className={styles.cardCta}>
              <h2>Pronto para anunciar seus imóveis com o melhor custo-benefício?</h2>
              <p>Cadastre-se gratuitamente agora mesmo e publique seu primeiro anúncio em menos de 3 minutos.</p>
              <Link href="/cadastro" className="btn btn-primario btn-lg">
                Criar Conta Gratuita
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
