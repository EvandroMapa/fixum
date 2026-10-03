/*
 * Ícones de linha da marca Fixum — grade 24px, traço 1.75, cantos arredondados.
 * Herdam a cor via currentColor. Substituem emojis na interface (brandbook, seção 07).
 *
 * Cada desenho é guardado como marcação SVG para servir tanto ao componente React
 * quanto a HTML montado fora do React (ex.: pins do Mapbox) via `iconeSvg()`.
 */

const CAMINHOS = {
  // navegação e ações
  busca: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  mapa: '<path d="M3 6.5L9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  // tachinha: o gesto de "fixar" um imóvel para comparar depois
  fixar: '<path d="M8.5 3.5h7"/><path d="M10 3.5v5.2L7 12.5h10l-3-3.8V3.5"/><path d="M12 12.5V21"/>',
  local: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  alvo: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  mira: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5"/><circle cx="12" cy="12" r="7.5"/>',
  filtros: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  camadas: '<path d="M12 3L3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  voltar: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chevronBaixo: '<path d="M6 9l6 6 6-6"/>',
  chevronCima: '<path d="M6 15l6-6 6 6"/>',
  chevronDireita: '<path d="M9 6l6 6-6 6"/>',
  chevronEsquerda: '<path d="M15 6l-6 6 6 6"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  compartilhar: '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  copiar: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5.5A1.5 1.5 0 0 0 14 4H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  editar: '<path d="M4 20h4.5L19.5 9 15 4.5 4 15.5zM13 6.5l4.5 4.5"/>',
  lixeira: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13M10 10.5v6M14 10.5v6"/>',
  salvar: '<path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  atualizar: '<path d="M20 11a8 8 0 0 0-14.5-4.5M4 13a8 8 0 0 0 14.5 4.5"/><path d="M5 3v4h4M19 21v-4h-4"/>',
  baixar: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
  enviar: '<path d="M12 20V9M7.5 13.5L12 9l4.5 4.5M5 5h14"/>',
  anexo: '<path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.1-8.1a3.3 3.3 0 0 1 4.7 4.7l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5"/>',
  sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  olhoFechado: '<path d="M4 4l16 16M10.6 6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.4 7.6A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9.5 9.5 0 0 0 4.2-1"/>',
  pausa: '<path d="M9 6v12M15 6v12"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',

  // imóvel
  casa: '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  predio: '<path d="M5 21V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 15 5v16M15 10h3.5A1.5 1.5 0 0 1 20 11.5V21M3 21h18"/><path d="M8.5 7.5h3M8.5 11h3M8.5 14.5h3"/>',
  chave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
  quarto: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11.5" r="1.6"/>',
  banho: '<path d="M3 12h18v1.5A5.5 5.5 0 0 1 15.5 19h-7A5.5 5.5 0 0 1 3 13.5z"/><path d="M6 12V6.5a2.5 2.5 0 0 1 4.6-1.3M7 19l-1 2M17 19l1 2"/>',
  vaga: '<path d="M4 16.5h16v-4l-2-5H6l-2 5z"/><path d="M4 12.5h16M6 16.5V19M18 16.5V19"/>',
  area: '<path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>',
  folha: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l7-7"/>',
  caminhada: '<circle cx="13" cy="4.5" r="1.5"/><path d="M10 21l2.5-6 2.5 2V21M9 12l2-4.5 3 1.5 2 3M11 7.5L8 9.5V12"/>',
  foto: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',

  // pessoas e negócios
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  maleta: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2M3 12.5h18"/>',
  escudo: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/>',
  cadeado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  coroa: '<path d="M4 8l4 4 4-6 4 6 4-4-1.5 11h-13z"/>',
  trofeu: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
  estrela: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  painel: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  cartao: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  moeda: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2.1 0 2.9 5.8 1.4 5.8 4.3 0 1.3-1.3 2.1-3 2.1-1.3 0-2.4-.6-2.9-1.5M12 6v1.8M12 16.3V18"/>',
  etiqueta: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0z"/><circle cx="8" cy="8" r="1.5"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  tendencia: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  raio: '<path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z"/>',

  // comunicação e tempo
  chat: '<path d="M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7.5z"/><path d="M8.5 9h7M8.5 12.5h4"/>',
  telefone: '<path d="M5 4h3.5l1.5 4.5-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 0 1 5 4z"/>',
  email: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6.5L20.5 7"/>',
  sino: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  globo: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5z"/>',

  // estados
  alerta: '<path d="M12 4L2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
  bloqueio: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  ponto: '<circle cx="12" cy="12" r="4" fill="currentColor"/>',

  // documentos
  lista: '<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5v.1M4.5 12v.1M4.5 17.5v.1"/>',
  documento: '<path d="M6 3.5h8l4.5 4.5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M14 3.5V8h4.5M8.5 12.5h7M8.5 16h5"/>',
  pasta: '<path d="M3.5 6.5a1 1 0 0 1 1-1h5l2 2.5h8a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z"/>',

  // entorno
  carrinho: '<path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H6.4"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  farmacia: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  escola: '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c1.5 1.5 3.4 2.3 5.5 2.3s4-.8 5.5-2.3v-5M21.5 9v5"/>',
  talheres: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 1.4-3 3.6-3 7v4h3"/>',
  haltere: '<path d="M6.5 7.5v9M3.5 10v4M17.5 7.5v9M20.5 10v4M6.5 12h11"/>',
  hospital: '<path d="M4 21V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v15M2.5 21h19M12 8.5v5M9.5 11h5M10 21v-4h4v4"/>',
  banco: '<path d="M3 9.5L12 4l9 5.5M4.5 9.5h15M6 9.5v8M10 9.5v8M14 9.5v8M18 9.5v8M3.5 20.5h17M4.5 17.5h15"/>',
  onibus: '<rect x="5" y="3.5" width="14" height="14" rx="2.5"/><path d="M5 11h14M8.5 14.5h.1M15.5 14.5h.1M7.5 17.5V20M16.5 17.5V20"/>',
} as const

export type NomeIcone = keyof typeof CAMINHOS

export function ehNomeIcone(valor: unknown): valor is NomeIcone {
  return typeof valor === 'string' && valor in CAMINHOS
}

const FIXADO =
  '<path d="M8.5 3.5h7"/><path d="M10 3.5v5.2L7 12.5h10l-3-3.8V3.5z" fill="currentColor"/><path d="M12 12.5V21"/>'
const LOCAL_PREENCHIDO =
  '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" fill="currentColor"/>' +
  '<circle cx="12" cy="10" r="2.3" fill="#fff" stroke="none"/>'

/** Marcação SVG completa, para HTML montado fora do React. */
export function iconeSvg(nome: NomeIcone, tamanho = 20, espessura = 1.75): string {
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${espessura}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAMINHOS[nome]}</svg>`
}

interface Props {
  nome: NomeIcone
  tamanho?: number
  className?: string
  /** Preenche o ícone "fixar" (estado fixado). */
  preenchido?: boolean
  titulo?: string
  espessura?: number
}

export default function Icone({ nome, tamanho = 20, className, preenchido, titulo, espessura = 1.75 }: Props) {
  const conteudo = preenchido && nome === 'fixar' ? FIXADO : preenchido && nome === 'local' ? LOCAL_PREENCHIDO : CAMINHOS[nome] ?? ''
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={espessura}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={titulo ? undefined : true}
      role={titulo ? 'img' : undefined}
      style={{ flexShrink: 0 }}
    >
      {titulo && <title>{titulo}</title>}
      <g dangerouslySetInnerHTML={{ __html: conteudo }} />
    </svg>
  )
}
