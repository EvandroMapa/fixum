import { NextResponse } from 'next/server'

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

/*
 * osm: filtros de tags do OpenStreetMap (busca por TIPO de lugar num raio, via Overpass).
 * query: termo de texto usado só como reserva (Nominatim), se o Overpass falhar.
 * semNome: rótulo para lugares sem nome no mapa (comum em pontos de ônibus).
 */
const CATEGORIAS_CONFIG: Record<string, { osm: string[]; query: string; semNome: string; icone: string; label: string; cor: string }> = {
  supermercados: { osm: ['["shop"~"^(supermarket|convenience)$"]'], query: 'supermercado', semNome: 'Mercado', icone: 'carrinho', label: 'Supermercados', cor: '#2E6B4E' },
  farmacias: { osm: ['["amenity"="pharmacy"]'], query: 'farmacia', semNome: 'Farmácia', icone: 'farmacia', label: 'Farmácias', cor: '#B23318' },
  escolas: { osm: ['["amenity"~"^(school|kindergarten)$"]'], query: 'escola', semNome: 'Escola', icone: 'escola', label: 'Escolas e creches', cor: '#2C5F8A' },
  restaurantes: { osm: ['["amenity"~"^(restaurant|cafe|fast_food)$"]'], query: 'restaurante', semNome: 'Restaurante', icone: 'talheres', label: 'Restaurantes e cafés', cor: '#C0662B' },
  academias: { osm: ['["leisure"="fitness_centre"]'], query: 'academia', semNome: 'Academia', icone: 'haltere', label: 'Academias', cor: '#5B4A7A' },
  hospitais: { osm: ['["amenity"~"^(hospital|clinic)$"]'], query: 'hospital', semNome: 'Clínica', icone: 'hospital', label: 'Hospitais e clínicas', cor: '#A8323E' },
  bancos: { osm: ['["amenity"~"^(bank|atm)$"]'], query: 'banco', semNome: 'Caixa eletrônico', icone: 'banco', label: 'Bancos e caixas', cor: '#2F6F6A' },
  transporte: { osm: ['["highway"="bus_stop"]', '["amenity"="bus_station"]'], query: 'onibus', semNome: 'Ponto de ônibus', icone: 'onibus', label: 'Transporte público', cor: '#45566B' },
}

const RAIO_METROS = 2000
const USER_AGENT = 'FixumPortalImoveis/1.0 (contato@fixum.com.br)'
const OVERPASS_SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

type LugarBruto = { id: string; nome: string | null; lat: number; lng: number }
type ElementoOverpass = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }
type ResultadoNominatim = { place_id: number; name?: string; display_name?: string; lat: string; lon: string }

/** Lugares de um tipo num raio ao redor do imóvel (OpenStreetMap via Overpass). */
async function buscarOverpass(lat: number, lng: number, filtros: string[]): Promise<LugarBruto[] | null> {
  const consultas = filtros.map((f) => `nwr${f}(around:${RAIO_METROS},${lat},${lng});`).join('')
  const consulta = `[out:json][timeout:15];(${consultas});out center 60;`
  // Servidor principal e um espelho: o Overpass público às vezes recusa por excesso de uso
  for (const servidor of OVERPASS_SERVIDORES) {
    try {
      const res = await fetch(servidor, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(consulta)}`,
        signal: AbortSignal.timeout(12000),
      })
      if (!res.ok) continue
      const json = await res.json()
      if (!Array.isArray(json?.elements)) continue
      return json.elements
        .map((e: ElementoOverpass) => ({
          id: `${e.type}${e.id}`,
          nome: nomeDoLugar(e.tags),
          lat: e.lat ?? e.center?.lat,
          lng: e.lon ?? e.center?.lon,
        }))
        .filter((e: LugarBruto) => typeof e.lat === 'number' && typeof e.lng === 'number')
    } catch {
      /* tenta o próximo servidor */
    }
  }
  return null
}

/** Caixa eletrônico costuma ter o nome da rua na tag "name"; nesse caso vale o banco. */
function nomeDoLugar(tags: Record<string, string> | undefined): string | null {
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

// Cache em memória: chave "lat_lng_cat" → dados com validade de 2 horas
const cachePois = new Map<string, { timestamp: number; pois: PontoInteresse[] }>()
const CACHE_TTL = 2 * 60 * 60 * 1000

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

    const configCat = CATEGORIAS_CONFIG[categoria] || CATEGORIAS_CONFIG.supermercados
    const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${categoria}`

    // 1. Verificar cache
    const cacheado = cachePois.get(cacheKey)
    if (cacheado && Date.now() - cacheado.timestamp < CACHE_TTL) {
      return NextResponse.json({
        categoria,
        label: configCat.label,
        icone: configCat.icone,
        cor: configCat.cor,
        pois: cacheado.pois,
      })
    }

    // 2. Lugares do tipo num raio de 2 km (Overpass); se falhar, busca por texto (Nominatim)
    const doOverpass = await buscarOverpass(lat, lng, configCat.osm)
    const lugares = doOverpass ?? (await buscarNominatim(lat, lng, configCat.query))

    const poisEncontrados: PontoInteresse[] = []
    for (const item of lugares) {
      if (isNaN(item.lat) || isNaN(item.lng)) continue
      const dist = calcularDistanciaMetros(lat, lng, item.lat, item.lng)
      if (dist > 3500) continue // Ignora se estiver a mais de 3,5 km

      const tempoMin = Math.max(1, Math.ceil(dist / 80)) // média 80 m por minuto caminhando

      poisEncontrados.push({
        id: `poi_${categoria}_${item.id}`,
        nome: (item.nome || configCat.semNome).trim(),
        categoria,
        icone: configCat.icone,
        distanciaMetros: dist,
        distanciaFormatada: dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1).replace('.', ',')} km`,
        tempoPe: `${tempoMin} min a pé`,
        lat: item.lat,
        lng: item.lng,
      })
    }

    // Do mais perto ao mais longe; um por nome (o mais próximo) e no máximo 10
    poisEncontrados.sort((a, b) => a.distanciaMetros - b.distanciaMetros)
    const vistos = new Set<string>()
    const pois = poisEncontrados
      .filter((p) => {
        const chave = p.nome.toLowerCase()
        if (vistos.has(chave)) return false
        vistos.add(chave)
        return true
      })
      .slice(0, 10)

    // Só guarda no cache o resultado do Overpass (o da busca reserva é pior e não deve ficar 2 h)
    if (doOverpass) cachePois.set(cacheKey, { timestamp: Date.now(), pois })

    return NextResponse.json({
      categoria,
      label: configCat.label,
      icone: configCat.icone,
      cor: configCat.cor,
      pois,
    })
  } catch (err: any) {
    console.error('Erro na rota de POIs do entorno:', err)
    return NextResponse.json({ error: err.message || 'Erro ao buscar conveniências do entorno.' }, { status: 500 })
  }
}
