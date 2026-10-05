import { NextResponse } from 'next/server'
import { criarClienteAdmin } from '@/lib/supabase/admin'

interface PontoInteresse {
  id: string
  nome: string
  categoria: string
  icone: string
  distanciaMetros: number
  distanciaFormatada: string
  tempoPe: string
  lat: number
  lng: number
}

type Tags = Record<string, string>

/*
 * osm: filtros de tags do OpenStreetMap (busca por TIPO de lugar num raio, via Overpass).
 * raio: categorias muito densas (restaurantes, pontos de ônibus) usam raio menor.
 * query: termo de texto usado só como reserva (Nominatim), se o Overpass falhar.
 * semNome: rótulo para lugares sem nome no mapa (comum em pontos de ônibus).
 */
const CATEGORIAS_CONFIG: Record<
  string,
  { osm: string[]; raio: number; query: string; semNome: string; icone: string; label: string; cor: string }
> = {
  supermercados: {
    osm: ['["shop"~"^(supermarket|convenience)$"]'],
    raio: 2000, query: 'supermercado', semNome: 'Mercado', icone: 'carrinho', label: 'Supermercados', cor: '#2E6B4E',
  },
  farmacias: {
    osm: ['["amenity"="pharmacy"]'],
    raio: 2000, query: 'farmacia', semNome: 'Farmácia', icone: 'farmacia', label: 'Farmácias', cor: '#B23318',
  },
  escolas: {
    osm: ['["amenity"~"^(school|kindergarten)$"]'],
    raio: 2000, query: 'escola', semNome: 'Escola', icone: 'escola', label: 'Escolas e creches', cor: '#2C5F8A',
  },
  restaurantes: {
    osm: ['["amenity"~"^(restaurant|cafe|fast_food)$"]'],
    raio: 1000, query: 'restaurante', semNome: 'Restaurante', icone: 'talheres', label: 'Restaurantes e cafés', cor: '#C0662B',
  },
  academias: {
    osm: ['["leisure"="fitness_centre"]'],
    raio: 2000, query: 'academia', semNome: 'Academia', icone: 'haltere', label: 'Academias', cor: '#5B4A7A',
  },
  hospitais: {
    osm: ['["amenity"~"^(hospital|clinic)$"]'],
    raio: 2000, query: 'hospital', semNome: 'Clínica', icone: 'hospital', label: 'Hospitais e clínicas', cor: '#A8323E',
  },
  bancos: {
    osm: ['["amenity"~"^(bank|atm)$"]'],
    raio: 2000, query: 'banco', semNome: 'Caixa eletrônico', icone: 'banco', label: 'Bancos e caixas', cor: '#2F6F6A',
  },
  transporte: {
    osm: ['node|["highway"="bus_stop"]', '["amenity"="bus_station"]'],
    raio: 1000, query: 'onibus', semNome: 'Ponto de ônibus', icone: 'onibus', label: 'Transporte público', cor: '#45566B',
  },
}

// Buscar todas as categorias (com a reserva do Nominatim) pode levar alguns segundos
export const maxDuration = 60

const USER_AGENT = 'FixumPortalImoveis/1.0 (contato@fixum.com.br)'
const OVERPASS_SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
// Os lugares mudam pouco: a CDN pode guardar a resposta por um dia
const CABECALHO_CACHE = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' }

type LugarBruto = { id: string; nome: string | null; lat: number; lng: number; tags: Tags }
type ElementoOverpass = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags }
type ResultadoNominatim = { place_id: number; name?: string; display_name?: string; lat: string; lon: string }

/** Consulta o Overpass (servidor principal e um espelho, que às vezes recusa por excesso de uso). */
async function consultarOverpass(consulta: string, prazoMs = 12000, servidores = OVERPASS_SERVIDORES): Promise<LugarBruto[] | null> {
  for (const servidor of servidores) {
    try {
      const res = await fetch(servidor, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(consulta)}`,
        signal: AbortSignal.timeout(prazoMs),
      })
      if (!res.ok) continue
      const json = await res.json()
      if (!Array.isArray(json?.elements)) continue
      return (json.elements as ElementoOverpass[])
        .map((e) => ({
          id: `${e.type}${e.id}`,
          nome: nomeDoLugar(e.tags),
          lat: e.lat ?? e.center?.lat ?? NaN,
          lng: e.lon ?? e.center?.lon ?? NaN,
          tags: e.tags ?? {},
        }))
        .filter((e) => !isNaN(e.lat) && !isNaN(e.lng))
    } catch {
      /* tenta o próximo servidor */
    }
  }
  return null
}

/**
 * Monta as consultas com o raio ANTES do filtro de tipo ("nwr(around:...)[amenity=...]"):
 * assim o Overpass usa o índice espacial primeiro, o que é várias vezes mais rápido.
 * Um filtro pode trazer o tipo de elemento na frente ("node|[...]"); o padrão é nwr.
 */
/** Executa fn para cada item, no máximo "limite" ao mesmo tempo, mantendo a ordem. */
async function emLotes<T, R>(itens: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(itens.length)
  let proximo = 0
  await Promise.all(
    Array.from({ length: Math.min(limite, itens.length) }, async () => {
      while (proximo < itens.length) {
        const i = proximo++
        resultados[i] = await fn(itens[i])
      }
    })
  )
  return resultados
}

function filtrosOverpass(categorias: string[], lat: number, lng: number) {
  return categorias
    .flatMap((id) =>
      CATEGORIAS_CONFIG[id].osm.map((f) => {
        const [tipo, filtro] = f.includes('|') ? f.split('|') : ['nwr', f]
        return `${tipo}(around:${CATEGORIAS_CONFIG[id].raio},${lat},${lng})${filtro};`
      })
    )
    .join('')
}

/** Caixa eletrônico costuma ter o nome da rua na tag "name"; nesse caso vale o banco. */
function nomeDoLugar(tags: Tags | undefined): string | null {
  if (!tags) return null
  if (tags.amenity === 'atm') return tags.brand || tags.operator || null
  return tags.name || tags.brand || null
}

/** Reserva: busca por texto no Nominatim (menos precisa; só se o Overpass falhar). */
async function buscarNominatim(lat: number, lng: number, termo: string): Promise<LugarBruto[]> {
  const delta = 0.025
  const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(termo)}&format=json&viewbox=${viewbox}&bounded=1&limit=10`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, next: { revalidate: 3600 } })
    if (!res.ok) return []
    const dados = await res.json()
    if (!Array.isArray(dados)) return []
    return dados.map((item: ResultadoNominatim) => ({
      id: String(item.place_id),
      nome: item.name || (item.display_name ? item.display_name.split(',')[0] : null),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      tags: {},
    }))
  } catch {
    return []
  }
}

function calcularDistanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 1000)
}

/** Os 10 lugares mais próximos de uma categoria (um por nome). */
function montarPois(categoria: string, lugares: LugarBruto[], lat: number, lng: number): PontoInteresse[] {
  const config = CATEGORIAS_CONFIG[categoria]
  const pois: PontoInteresse[] = []
  for (const item of lugares) {
    const dist = calcularDistanciaMetros(lat, lng, item.lat, item.lng)
    if (dist > 3500) continue // Ignora se estiver a mais de 3,5 km
    const tempoMin = Math.max(1, Math.ceil(dist / 80)) // média 80 m por minuto caminhando
    pois.push({
      id: `poi_${categoria}_${item.id}`,
      nome: (item.nome || config.semNome).trim(),
      categoria,
      icone: config.icone,
      distanciaMetros: dist,
      distanciaFormatada: dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1).replace('.', ',')} km`,
      tempoPe: `${tempoMin} min a pé`,
      lat: item.lat,
      lng: item.lng,
    })
  }

  pois.sort((a, b) => a.distanciaMetros - b.distanciaMetros)
  const vistos = new Set<string>()
  return pois
    .filter((p) => {
      const chave = p.nome.toLowerCase()
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
    .slice(0, 10)
}

// Cache no banco (tabela entorno_cache): um registro por endereço com as 8 categorias.
// A primeira visita calcula no Overpass; as próximas leem daqui. Refaz a cada 30 dias.
// Se a tabela ainda não existir, tudo segue funcionando só com o Overpass.
// Resultado completo do Overpass vale 30 dias; o parcial (com a reserva do Nominatim), 1 dia
const VALIDADE_BANCO_MS = 30 * 24 * 60 * 60 * 1000
const VALIDADE_PARCIAL_MS = 24 * 60 * 60 * 1000
type DadosTodas = { categorias: Record<string, PontoInteresse[]>; completo?: boolean }

async function lerBanco(chave: string): Promise<{ dados: DadosTodas; recente: boolean } | null> {
  try {
    const { data } = await criarClienteAdmin()
      .from('entorno_cache')
      .select('dados, atualizado_em')
      .eq('chave', chave)
      .maybeSingle()
    if (!data?.dados?.categorias) return null
    return {
      dados: data.dados as DadosTodas,
      recente:
        Date.now() - new Date(data.atualizado_em).getTime() <
        (data.dados.completo === false ? VALIDADE_PARCIAL_MS : VALIDADE_BANCO_MS),
    }
  } catch {
    return null
  }
}

async function gravarBanco(chave: string, dados: DadosTodas) {
  try {
    await criarClienteAdmin()
      .from('entorno_cache')
      .upsert({ chave, dados, atualizado_em: new Date().toISOString() })
  } catch {
    /* sem a tabela, só não guarda */
  }
}

// Cache em memória: chave "lat_lng_categoria" → dados com validade de 2 horas
const cachePois = new Map<string, { timestamp: number; dados: unknown }>()
const CACHE_TTL = 2 * 60 * 60 * 1000

function lerCache(chave: string) {
  const item = cachePois.get(chave)
  return item && Date.now() - item.timestamp < CACHE_TTL ? item.dados : null
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const latStr = searchParams.get('lat')
    const lngStr = searchParams.get('lng')
    const categoria = searchParams.get('categoria') || 'supermercados'

    if (!latStr || !lngStr) {
      return NextResponse.json({ error: 'Parâmetros lat e lng são obrigatórios.' }, { status: 400 })
    }

    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)

    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
      return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 })
    }

    const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${categoria}`
    const cacheado = lerCache(cacheKey)
    if (cacheado) return NextResponse.json(cacheado, { headers: CABECALHO_CACHE })

    const chaveEndereco = `${lat.toFixed(4)}_${lng.toFixed(4)}`
    const doBanco = await lerBanco(chaveEndereco)

    // Todas as categorias numa consulta só (a tela troca de categoria sem esperar)
    if (categoria === 'todas') {
      if (doBanco?.recente) {
        cachePois.set(cacheKey, { timestamp: Date.now(), dados: doBanco.dados })
        return NextResponse.json(doBanco.dados, { headers: CABECALHO_CACHE })
      }
      // Uma consulta pequena por categoria, até 4 ao mesmo tempo (limite do Overpass por IP).
      // Uma consulta única com tudo junto é pesada e estoura o tempo do servidor público.
      const ids = Object.keys(CATEGORIAS_CONFIG)
      // Aqui só o servidor principal, com prazo curto: o espelho é lento demais para quem está na página
      const doOverpass = await emLotes(ids, 4, (id) =>
        consultarOverpass(`[out:json][timeout:10];(${filtrosOverpass([id], lat, lng)});out center;`, 10000, OVERPASS_SERVIDORES.slice(0, 1))
      )

      // Overpass fora do ar e já existe um dado antigo no banco: serve o antigo
      if (doOverpass.every((l) => l === null) && doBanco) return NextResponse.json(doBanco.dados)

      // Categoria que falhou no Overpass usa a reserva (Nominatim: no máximo 1 consulta por segundo)
      const categorias: Record<string, PontoInteresse[]> = {}
      let completo = true
      for (const [i, id] of ids.entries()) {
        let lugares = doOverpass[i]
        if (!lugares) {
          completo = false
          lugares = await buscarNominatim(lat, lng, CATEGORIAS_CONFIG[id].query)
          await new Promise((ok) => setTimeout(ok, 1100))
        }
        categorias[id] = montarPois(id, lugares, lat, lng)
      }

      // O parcial também é guardado (o próximo visitante não espera), mas vale só 1 dia
      const dados: DadosTodas = { categorias, completo }
      await gravarBanco(chaveEndereco, dados)
      if (completo) {
        cachePois.set(cacheKey, { timestamp: Date.now(), dados })
        return NextResponse.json(dados, { headers: CABECALHO_CACHE })
      }
      return NextResponse.json(dados)
    }

    // Uma categoria: do banco, se houver; senão Overpass (e, se falhar, texto no Nominatim)
    const configCat = CATEGORIAS_CONFIG[categoria] || CATEGORIAS_CONFIG.supermercados
    const idCat = CATEGORIAS_CONFIG[categoria] ? categoria : 'supermercados'
    const salvo = doBanco?.dados.categorias[idCat]
    if (salvo) {
      return NextResponse.json(
        { categoria: idCat, label: configCat.label, icone: configCat.icone, cor: configCat.cor, pois: salvo },
        { headers: CABECALHO_CACHE }
      )
    }
    const doOverpass = await consultarOverpass(`[out:json][timeout:15];(${filtrosOverpass([idCat], lat, lng)});out center;`)
    const lugares = doOverpass ?? (await buscarNominatim(lat, lng, configCat.query))
    const dados = {
      categoria: idCat,
      label: configCat.label,
      icone: configCat.icone,
      cor: configCat.cor,
      pois: montarPois(idCat, lugares, lat, lng),
    }

    // Só guarda o resultado do Overpass (o da busca reserva é pior e não deve ficar 2 h)
    if (doOverpass) {
      cachePois.set(cacheKey, { timestamp: Date.now(), dados })
      return NextResponse.json(dados, { headers: CABECALHO_CACHE })
    }
    return NextResponse.json(dados)
  } catch (err: unknown) {
    console.error('Erro na rota de POIs do entorno:', err)
    const mensagem = err instanceof Error ? err.message : 'Erro ao buscar conveniências do entorno.'
    return NextResponse.json({ error: mensagem }, { status: 500 })
  }
}
