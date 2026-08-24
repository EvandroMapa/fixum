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

const CATEGORIAS_CONFIG: Record<string, { query: string; icone: string; label: string; cor: string }> = {
  supermercados: { query: 'supermercado', icone: '🛒', label: 'Supermercados', cor: '#16a34a' },
  farmacias: { query: 'farmacia', icone: '💊', label: 'Farmácias', cor: '#dc2626' },
  escolas: { query: 'escola', icone: '🏫', label: 'Escolas e Creches', cor: '#2563eb' },
  restaurantes: { query: 'restaurante', icone: '🍽️', label: 'Restaurantes e Cafés', cor: '#ea580c' },
  academias: { query: 'academia', icone: '🏋️', label: 'Academias', cor: '#9333ea' },
  hospitais: { query: 'hospital', icone: '🏥', label: 'Hospitais e Clínicas', cor: '#e11d48' },
  bancos: { query: 'banco', icone: '🏦', label: 'Bancos e Caixas', cor: '#0d9488' },
  transporte: { query: 'onibus', icone: '🚌', label: 'Transporte Público', cor: '#4f46e5' },
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

    // 2. Consultar OpenStreetMap Nominatim com viewbox delimitada (~2.5km de raio)
    const delta = 0.025
    const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      configCat.query
    )}&format=json&viewbox=${viewbox}&bounded=1&limit=10&addressdetails=1`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'FixumPortalImoveis/1.0 (contato@fixum.com.br)',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json({ categoria, pois: [] })
    }

    const dadosJson = await res.json()

    if (!Array.isArray(dadosJson)) {
      return NextResponse.json({ categoria, pois: [] })
    }

    const nomesUnicos = new Set<string>()
    const poisEncontrados: PontoInteresse[] = []

    for (const item of dadosJson) {
      const itemLat = parseFloat(item.lat)
      const itemLng = parseFloat(item.lon)
      if (isNaN(itemLat) || isNaN(itemLng)) continue

      const dist = calcularDistanciaMetros(lat, lng, itemLat, itemLng)
      if (dist > 3500) continue // Ignora se estiver a mais de 3.5km

      let nomeLimpo = item.name || (item.display_name ? item.display_name.split(',')[0] : configCat.label)
      nomeLimpo = nomeLimpo.trim()

      if (nomesUnicos.has(nomeLimpo.toLowerCase())) continue
      nomesUnicos.add(nomeLimpo.toLowerCase())

      const tempoMin = Math.max(1, Math.ceil(dist / 80)) // média 80m por minuto caminhando

      poisEncontrados.push({
        id: `poi_${categoria}_${item.place_id || Math.random().toString(36).substring(2, 8)}`,
        nome: nomeLimpo,
        categoria,
        icone: configCat.icone,
        distanciaMetros: dist,
        distanciaFormatada: dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)} km`,
        tempoPe: `${tempoMin} min a pé`,
        lat: itemLat,
        lng: itemLng,
      })
    }

    // Ordenar da menor para a maior distância
    poisEncontrados.sort((a, b) => a.distanciaMetros - b.distanciaMetros)

    // Salvar no cache
    cachePois.set(cacheKey, { timestamp: Date.now(), pois: poisEncontrados })

    return NextResponse.json({
      categoria,
      label: configCat.label,
      icone: configCat.icone,
      cor: configCat.cor,
      pois: poisEncontrados,
    })
  } catch (err: any) {
    console.error('Erro na rota de POIs do entorno:', err)
    return NextResponse.json({ error: err.message || 'Erro ao buscar conveniências do entorno.' }, { status: 500 })
  }
}
