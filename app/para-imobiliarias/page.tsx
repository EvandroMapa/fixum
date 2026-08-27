'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { PLANOS_OFICIAIS, formatarMoeda } from '@/lib/planos'
import { linkWhatsAppComercial } from '@/lib/constants'
import styles from './page.module.css'

export default function ParaImobiliariasPage() {
  const [qtdImoveis, setQtdImoveis] = useState<number>(100)

  // Filtrar planos corporativos (a partir de 21 imóveis)
  const planosCorporativos = PLANOS_OFICIAIS.filter((p) => p.limite_imoveis_min >= 21)

  // Encontrar plano corporativo recomendado pelo simulador
  const planoRecomendado =
    planosCorporativos.find((p) => qtdImoveis <= p.limite_imoveis_max) ||
    planosCorporativos[planosCorporativos.length - 1]

  const faixasImobiliaria = [50, 100, 200, 500, 1000]

  return (
    <>
      <Header />
      <div className={styles.pagina}>
        {/* ── HERO CORPORATIVO ── */}
        <section className={styles.hero}>
          <div className={styles.container}>
            <div className={styles.heroBadge}>
              <span>🏢 Fixum para Imobiliárias & Redes</span>
            </div>

            <h1 className={styles.heroTitulo}>
              Aumente a visibilidade de toda a sua carteira de imóveis.<br />
              <span className={styles.gradiente}>Com o menor custo por anúncio do Brasil.</span>
            </h1>

            <p className={styles.heroSubtitulo}>
              Soluções corporativas completas para imobiliárias, incorporadoras e redes de corretores.
              Exponha centenas de imóveis no mapa, gerencie múltiplos corretores e receba leads qualificados diretamente no seu WhatsApp e CRM.
            </p>

            <div className={styles.heroAcoes}>
              <Link href="/cadastro?tipo=imobiliaria" className="btn btn-primario btn-lg">
                🏢 Cadastrar Minha Imobiliária
              </Link>
              <Link href="/painel" className="btn btn-outline btn-lg" style={{ background: '#ffffff', color: '#0f4c81', borderColor: '#cbd5e1' }}>
                🔑 Acessar Painel Imobiliário
              </Link>
              <a
                href={linkWhatsAppComercial(undefined, 'Olá! Gostaria de saber mais sobre os planos da Fixum para minha imobiliária.')}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-lg"
              >
                💬 Falar com um Consultor
              </a>
            </div>

            {/* Transição para planos individuais */}
            <div className={styles.linkPessoaFisica}>
              É corretor autônomo ou proprietário individual?{' '}
              <Link href="/planos">Ver planos para pessoas físicas e corretores →</Link>
            </div>
          </div>
        </section>

        {/* ── NÚMEROS E DIFERENCIAIS B2B ── */}
        <section className={styles.secaoDiferenciais}>
          <div className={styles.container}>
            <div className={styles.gridDiferenciais}>
              <div className={styles.cardDiferencial}>
                <span className={styles.iconeDiferencial}>💰</span>
                <span className={styles.destaqueDiferencial}>A partir de R$ 1,20</span>
                <h4>Custo por Imóvel</h4>
                <p>Quanto maior sua carteira, menor o custo de cada anúncio ativo.</p>
              </div>

              <div className={styles.cardDiferencial}>
                <span className={styles.iconeDiferencial}>👥</span>
                <span className={styles.destaqueDiferencial}>Múltiplos Corretores</span>
                <h4>Gestão de Equipe</h4>
                <p>Cadastre seus corretores para operarem sob a mesma conta e cota corporativa.</p>
              </div>

              <div className={styles.cardDiferencial}>
                <span className={styles.iconeDiferencial}>🏷️</span>
                <span className={styles.destaqueDiferencial}>Sua Marca em Destaque</span>
                <h4>Branding Imobiliário</h4>
                <p>Seu logotipo e página exclusiva da imobiliária em todos os seus anúncios no mapa.</p>
              </div>

              <div className={styles.cardDiferencial}>
                <span className={styles.iconeDiferencial}>0%</span>
                <span className={styles.destaqueDiferencial}>Zero Comissão</span>
                <h4>Lucro 100% Seu</h4>
                <p>A Fixum cobra apenas mensalidade de anúncio. Nenhuma taxa sobre o fechamento.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── SIMULADOR CORPORATIVO ── */}
        <section className={styles.secaoSimulador}>
          <div className={styles.container}>
            <div className={styles.cardSimulador}>
              <div className={styles.simuladorHeader}>
                <h2>Simulador de Carteira Corporativa</h2>
                <p>Selecione o tamanho do estoque de imóveis da sua imobiliária</p>
              </div>

              <div className={styles.botoesFaixas}>
                {faixasImobiliaria.map((qtd) => (
                  <button
                    key={qtd}
                    type="button"
                    className={`${styles.btnFaixa} ${qtdImoveis === qtd ? styles.btnFaixaAtivo : ''}`}
                    onClick={() => setQtdImoveis(qtd)}
                  >
                    {qtd >= 1000 ? '+500 imóveis' : `${qtd} imóveis`}
                  </button>
                ))}
              </div>

              <div className={styles.sliderWrapper}>
                <input
                  type="range"
                  min="21"
                  max="500"
                  value={qtdImoveis > 500 ? 500 : qtdImoveis}
                  onChange={(e) => setQtdImoveis(parseInt(e.target.value))}
                  className={styles.rangeInput}
                />
                <div className={styles.rangeLabels}>
                  <span>21 imóveis</span>
                  <span>100</span>
                  <span>250</span>
                  <span>500+ imóveis</span>
                </div>
              </div>

              {/* Box de Resultado */}
              <div className={styles.resultadoSimulador}>
                <div className={styles.resultadoInfo}>
                  <span className={styles.tagResultado}>Plano Corporativo Ideal</span>
                  <h3>{planoRecomendado.nome}</h3>
                  <p>
                    Capacidade para até <strong>{planoRecomendado.limite_imoveis_max >= 99999 ? '+500' : planoRecomendado.limite_imoveis_max} anúncios ativos simultâneos</strong>.
                  </p>
                </div>

                <div className={styles.resultadoPreco}>
                  {planoRecomendado.id === 'enterprise_plus' ? (
                    <span className={styles.precoConsulta}>Sob Consulta (Personalizado)</span>
                  ) : (
                    <>
                      <div className={styles.precoMensal}>
                        <strong>{formatarMoeda(planoRecomendado.preco_mensal)}</strong>
                        <small>/mês</small>
                      </div>
                      {planoRecomendado.custo_unitario_max > 0 && (
                        <span className={styles.custoUnitarioBadge}>
                          Equivalente a apenas {formatarMoeda(planoRecomendado.custo_unitario_max)} por imóvel
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className={styles.resultadoAcao}>
                  <Link
                    href={`/cadastro?tipo=imobiliaria&plano=${planoRecomendado.id}`}
                    className="btn btn-primario"
                  >
                    {planoRecomendado.id === 'enterprise_plus' ? 'Falar com Consultor' : `Contratar ${planoRecomendado.nome}`}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TABELA DE PLANOS CORPORATIVOS ── */}
        <section className={styles.secaoPlanos}>
          <div className={styles.container}>
            <div className={styles.secaoHeaderCentral}>
              <h2>Planos Exclusivos para Imobiliárias</h2>
              <p>Escalabilidade, previsibilidade financeira e controle total para a sua empresa</p>
            </div>

            <div className={styles.gridPlanos}>
              {planosCorporativos.map((plano) => {
                const isDestaque = plano.id === 'imobiliaria'

                return (
                  <div
                    key={plano.id}
                    className={`${styles.cardPlano} ${isDestaque ? styles.cardPlanoDestaque : ''}`}
                  >
                    {isDestaque && <span className={styles.badgePopular}>Mais Escolhido</span>}

                    <h3 className={styles.cardPlanoNome}>{plano.nome}</h3>
                    <p className={styles.cardPlanoDesc}>{plano.descricao}</p>

                    <div className={styles.cardCapacidadeBox}>
                      <span className={styles.cardCapacidadeNumero}>
                        {plano.limite_imoveis_max >= 99999 ? '+500' : plano.limite_imoveis_max}
                      </span>
                      <span className={styles.cardCapacidadeTexto}>imóveis ativos simultâneos</span>
                    </div>

                    <div className={styles.cardPrecoBox}>
                      {plano.id === 'enterprise_plus' ? (
                        <span className={styles.valorConsulta}>Sob consulta</span>
                      ) : (
                        <>
                          <span className={styles.cifrao}>R$</span>
                          <span className={styles.valorGrande}>
                            {plano.preco_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                          <span className={styles.mes}>/mês</span>
                        </>
                      )}
                    </div>

                    {plano.custo_unitario_max > 0 && (
                      <span className={styles.badgeCustoUnitario}>
                        {formatarMoeda(plano.custo_unitario_max)} / imóvel / mês
                      </span>
                    )}

                    <ul className={styles.listaBeneficios}>
                      <li>✓ Multi-usuários para corretores da equipe</li>
                      <li>✓ Logotipo da imobiliária em todos os anúncios</li>
                      <li>✓ Perfil exclusivo da imobiliária na Fixum</li>
                      <li>✓ Leads diretos para o WhatsApp dos corretores</li>
                      <li>✓ Gestão de estoque com pausa e reativação livre</li>
                      <li>✓ Relatórios e suporte prioritário</li>
                    </ul>

                    <div className={styles.cardAcao}>
                      <Link
                        href={`/cadastro?tipo=imobiliaria&plano=${plano.id}`}
                        className={`btn ${isDestaque ? 'btn-primario' : 'btn-outline'} ${styles.btnContratar}`}
                      >
                        {plano.id === 'enterprise_plus' ? 'Solicitar Proposta' : `Assinar ${plano.nome}`}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── FAQ IMOBILIÁRIAS ── */}
        <section className={styles.secaoFaq}>
          <div className={styles.container}>
            <div className={styles.secaoHeaderCentral}>
              <h2>Dúvidas de Imobiliárias & Redes</h2>
              <p>Perguntas frequentes sobre faturamento corporativo e operação</p>
            </div>

            <div className={styles.gridFaq}>
              <div className={styles.faqCard}>
                <h4>Como funciona o cadastro de corretores da minha equipe?</h4>
                <p>
                  O administrador da imobiliária pode convidar corretores para a equipe. Eles cadastram imóveis sob o nome da imobiliária e compartilham o limite do plano corporativo.
                </p>
              </div>

              <div className={styles.faqCard}>
                <h4>Como funciona a emissão de nota fiscal e faturamento?</h4>
                <p>
                  Emitimos nota fiscal mensal para a sua pessoa jurídica (CNPJ) com opção de pagamento via Pix recorrente ou cartão corporativo.
                </p>
              </div>

              <div className={styles.faqCard}>
                <h4>Posso pausar imóveis que foram reservados?</h4>
                <p>
                  Sim! Ao pausar um imóvel vendido ou alugado, a vaga é liberada instantaneamente no seu plano para um novo anúncio, sem você perder as fotos ou o histórico.
                </p>
              </div>

              <div className={styles.faqCard}>
                <h4>Possuem integração com CRM imobiliário?</h4>
                <p>
                  Nossa equipe de engenharia está disponibilizando integrações via feed XML / API para sincronização automática de estoques de grandes imobiliárias.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL IMOBILIÁRIA ── */}
        <section className={styles.ctaFinal}>
          <div className={styles.container}>
            <div className={styles.cardCta}>
              <h2>Pronto para transformar a visibilidade da sua imobiliária?</h2>
              <p>
                Cadastre sua empresa hoje mesmo ou entre em contato com nossa equipe comercial para condições personalizadas.
              </p>
              <div className={styles.ctaBotoes}>
                <Link href="/cadastro?tipo=imobiliaria" className="btn btn-primario btn-lg">
                  Cadastrar Imobiliária Agora
                </Link>
                <Link
                  href="/painel"
                  className="btn btn-outline btn-lg"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', borderColor: '#ffffff' }}
                >
                  🔑 Já sou Parceiro (Entrar)
                </Link>
                <a
                  href={linkWhatsAppComercial(undefined, 'Olá! Gostaria de uma proposta comercial para minha imobiliária.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-lg"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', borderColor: '#ffffff' }}
                >
                  💬 WhatsApp Comercial
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
