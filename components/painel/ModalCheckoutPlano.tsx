'use client'

import { useState, useEffect, useRef } from 'react'
import { Plano } from '@/lib/types'
import { formatarMoeda } from '@/lib/planos'
import styles from './ModalCheckoutPlano.module.css'

interface Props {
  aberto: boolean
  onFechar: () => void
  plano: Plano
  usuarioId: string
  usuarioNome?: string
  usuarioEmail?: string
  usuarioTelefone?: string
  onPlanoAtivado: () => void
}

export default function ModalCheckoutPlano({
  aberto,
  onFechar,
  plano,
  usuarioId,
  usuarioNome = '',
  usuarioEmail = '',
  usuarioTelefone = '',
  onPlanoAtivado,
}: Props) {
  const [metodo, setMetodo] = useState<'pix' | 'cartao'>('pix')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  // Dados do Titular
  const [nome, setNome] = useState(usuarioNome)
  const [email, setEmail] = useState(usuarioEmail)
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [telefone, setTelefone] = useState(usuarioTelefone)

  // Dados do Cartão
  const [nomeCartao, setNomeCartao] = useState('')
  const [numeroCartao, setNumeroCartao] = useState('')
  const [validade, setValidade] = useState('')
  const [cvv, setCvv] = useState('')

  // Estado do PIX Gerado
  const [dadosPix, setDadosPix] = useState<{
    cobrancaId: string
    pixQrCode?: string
    pixCopiaCola?: string
    valor: number
    vencimento: string
  } | null>(null)
  const [copiado, setCopiado] = useState(false)

  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (usuarioNome && !nome) setNome(usuarioNome)
    if (usuarioEmail && !email) setEmail(usuarioEmail)
    if (usuarioTelefone && !telefone) setTelefone(usuarioTelefone)
  }, [usuarioNome, usuarioEmail, usuarioTelefone, nome, email, telefone])

  // Limpa polling ao desmontar ou fechar
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  if (!aberto) return null

  // Máscaras de entrada
  function handleCpfCnpjChange(val: string) {
    const limpo = val.replace(/\D/g, '')
    if (limpo.length <= 11) {
      // CPF: 000.000.000-00
      setCpfCnpj(
        limpo
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      )
    } else {
      // CNPJ: 00.000.000/0000-00
      setCpfCnpj(
        limpo
          .slice(0, 14)
          .replace(/(\d{2})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1/$2')
          .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
      )
    }
  }

  function handleNumeroCartaoChange(val: string) {
    const limpo = val.replace(/\D/g, '').slice(0, 16)
    setNumeroCartao(limpo.replace(/(\d{4})(?=\d)/g, '$1 '))
  }

  function handleValidadeChange(val: string) {
    const limpo = val.replace(/\D/g, '').slice(0, 4)
    if (limpo.length >= 3) {
      setValidade(`${limpo.slice(0, 2)}/${limpo.slice(2)}`)
    } else {
      setValidade(limpo)
    }
  }

  function handleCopiarPix() {
    if (!dadosPix?.pixCopiaCola) return
    navigator.clipboard.writeText(dadosPix.pixCopiaCola)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 3000)
  }

  // Inicia verificação contínua do PIX
  function iniciarPollingPix(cobrancaId: string) {
    if (pollingRef.current) clearInterval(pollingRef.current)

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/pagamentos/status?cobrancaId=${cobrancaId}&usuarioId=${usuarioId}&planoId=${plano.id}`
        )
        const data = await res.json()
        if (data.pago) {
          if (pollingRef.current) clearInterval(pollingRef.current)
          setSucesso(true)
          onPlanoAtivado()
          setTimeout(() => {
            onFechar()
          }, 2500)
        }
      } catch (err) {
        console.error('Erro no polling do PIX:', err)
      }
    }, 3000)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (!cpfCnpj || cpfCnpj.replace(/\D/g, '').length < 11) {
      setErro('Informe um CPF ou CNPJ válido para emissão da cobrança.')
      return
    }

    setCarregando(true)

    try {
      if (metodo === 'pix') {
        const res = await fetch('/api/pagamentos/criar-cobranca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuarioId,
            planoId: plano.id,
            metodoPagamento: 'pix',
            dadosPessoais: {
              nome,
              email,
              cpfCnpj,
              telefone,
            },
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao gerar o PIX.')
        }

        setDadosPix(data)
        iniciarPollingPix(data.cobrancaId)
      } else {
        // Cartão de Crédito
        const [mes, ano] = validade.split('/')
        if (!mes || !ano || mes.length !== 2 || (ano.length !== 2 && ano.length !== 4)) {
          throw new Error('Data de validade do cartão inválida. Use o formato MM/AA.')
        }

        const res = await fetch('/api/pagamentos/criar-cobranca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuarioId,
            planoId: plano.id,
            metodoPagamento: 'cartao',
            dadosPessoais: {
              nome,
              email,
              cpfCnpj,
              telefone,
            },
            dadosCartao: {
              nomeTitular: nomeCartao || nome,
              numeroCartao: numeroCartao.replace(/\s/g, ''),
              mesExpiracao: mes,
              anoExpiracao: ano,
              cvv,
              cpfCnpjTitular: cpfCnpj,
              telefoneTitular: telefone,
            },
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Erro ao processar assinatura no cartão.')
        }

        setSucesso(true)
        onPlanoAtivado()
        setTimeout(() => {
          onFechar()
        }, 2200)
      }
    } catch (err: any) {
      setErro(err.message || 'Ocorreu um erro ao processar o pagamento.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onFechar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.btnFechar} onClick={onFechar} aria-label="Fechar modal">
          ✕
        </button>

        {/* TOPO: RESUMO DO PLANO */}
        <div className={styles.topoPlano}>
          <div className={styles.topoPlanoGlow} />
          <span className={styles.badgePlano}>Assinatura Mensal</span>
          <h2 className={styles.nomePlano}>Plano {plano.nome}</h2>
          <div className={styles.precoPlano}>
            <span className={styles.valorGrande}>{formatarMoeda(plano.preco_mensal)}</span>
            <span className={styles.periodo}>/mês</span>
          </div>
        </div>

        {/* CONTEÚDO */}
        {sucesso ? (
          <div className={styles.telaSucesso}>
            <div className={styles.iconeSucesso}>✓</div>
            <h3>Pagamento Confirmado!</h3>
            <p>Seu plano <strong>{plano.nome}</strong> está ativo e sua cota de anúncios foi ampliada.</p>
          </div>
        ) : (
          <div className={styles.corpoModal}>
            {erro && <div className={styles.alertaErro}>{erro}</div>}

            {/* SELEÇÃO DO MÉTODO */}
            <div className={styles.abasMetodo}>
              <button
                type="button"
                className={`${styles.abaBtn} ${metodo === 'pix' ? styles.abaBtnAtiva : ''}`}
                onClick={() => {
                  setMetodo('pix')
                  setErro(null)
                }}
              >
                <span>⚡</span> PIX (Instantâneo)
              </button>
              <button
                type="button"
                className={`${styles.abaBtn} ${metodo === 'cartao' ? styles.abaBtnAtiva : ''}`}
                onClick={() => {
                  setMetodo('cartao')
                  setErro(null)
                  setDadosPix(null)
                  if (pollingRef.current) clearInterval(pollingRef.current)
                }}
              >
                <span>💳</span> Cartão de Crédito
              </button>
            </div>

            {/* FORMULÁRIO */}
            {metodo === 'pix' && dadosPix ? (
              // TELA DO PIX GERADO
              <div className={styles.boxPix}>
                <div className={styles.qrCodeWrapper}>
                  {dadosPix.pixQrCode ? (
                    <img
                      src={dadosPix.pixQrCode}
                      alt="QR Code PIX Fixum"
                      className={styles.qrCodeImg}
                    />
                  ) : (
                    <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      QR Code indisponível
                    </div>
                  )}
                </div>

                <div className={styles.copiaColaWrapper}>
                  <input
                    type="text"
                    readOnly
                    value={dadosPix.pixCopiaCola || ''}
                    className={styles.copiaColaInput}
                  />
                  <button
                    type="button"
                    className={styles.btnCopiarPix}
                    onClick={handleCopiarPix}
                  >
                    {copiado ? '✓ Código Copiado!' : '📋 Copiar Código PIX'}
                  </button>
                </div>

                <div className={styles.radarStatus}>
                  <span className={styles.pulsarPonto} />
                  <span>Aguardando pagamento no app do banco...</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.secaoForm}>
                {/* DADOS PESSOAIS / CADASTRAIS */}
                <div className={styles.formGrid2}>
                  <div className={styles.campo}>
                    <label>Nome / Razão Social</label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome completo ou da empresa"
                    />
                  </div>

                  <div className={styles.campo}>
                    <label>CPF ou CNPJ</label>
                    <input
                      type="text"
                      required
                      value={cpfCnpj}
                      onChange={(e) => handleCpfCnpjChange(e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className={styles.formGrid2}>
                  <div className={styles.campo}>
                    <label>E-mail para Faturas</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div className={styles.campo}>
                    <label>WhatsApp / Telefone</label>
                    <input
                      type="tel"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(31) 99999-9999"
                    />
                  </div>
                </div>

                {/* DADOS DO CARTÃO DE CRÉDITO */}
                {metodo === 'cartao' && (
                  <>
                    <div className={styles.campo}>
                      <label>Nome impresso no Cartão</label>
                      <input
                        type="text"
                        required
                        value={nomeCartao}
                        onChange={(e) => setNomeCartao(e.target.value.toUpperCase())}
                        placeholder="NOME COMO NO CARTAO"
                      />
                    </div>

                    <div className={styles.campo}>
                      <label>Número do Cartão</label>
                      <input
                        type="text"
                        required
                        value={numeroCartao}
                        onChange={(e) => handleNumeroCartaoChange(e.target.value)}
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                      />
                    </div>

                    <div className={styles.formGrid2}>
                      <div className={styles.campo}>
                        <label>Validade</label>
                        <input
                          type="text"
                          required
                          value={validade}
                          onChange={(e) => handleValidadeChange(e.target.value)}
                          placeholder="MM/AA"
                          maxLength={5}
                        />
                      </div>

                      <div className={styles.campo}>
                        <label>CVV / Cód. Segurança</label>
                        <input
                          type="text"
                          required
                          value={cvv}
                          onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          placeholder="123"
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={carregando}
                  className={styles.btnPrincipal}
                >
                  {carregando ? (
                    'Processando...'
                  ) : metodo === 'pix' ? (
                    '⚡ Gerar QR Code PIX'
                  ) : (
                    `💳 Assinar por ${formatarMoeda(plano.preco_mensal)}/mês`
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
