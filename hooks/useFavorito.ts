'use client'

import { useState, useEffect, useCallback } from 'react'
import { useModalLogin } from '@/contexts/ModalLoginContext'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook que gerencia o estado de favorito de um imóvel.
 * - Se não logado: abre modal de login ao tentar favoritar
 * - Se logado: salva/remove na tabela `favoritos` do Supabase
 */
export function useFavorito(imovelId: string) {
  const [favoritado, setFavoritado] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const { abrirModalLogin } = useModalLogin()
  const supabase = createClient()

  // Carrega estado inicial ao montar
  useEffect(() => {
    async function carregarFavorito() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data } = await supabase
        .from('favoritos')
        .select('id')
        .eq('usuario_id', session.user.id)
        .eq('imovel_id', imovelId)
        .maybeSingle()

      setFavoritado(!!data)
    }
    carregarFavorito()
  }, [imovelId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sincroniza com ações do mapa (MapaExplorar dispara evento global ao favoritar)
  useEffect(() => {
    function handleAtualizado(e: Event) {
      const { imovelId: id, favoritado: novoEstado } = (e as CustomEvent).detail
      if (id === imovelId) setFavoritado(novoEstado)
    }
    window.addEventListener('fixum:favoritoAtualizado', handleAtualizado)
    return () => window.removeEventListener('fixum:favoritoAtualizado', handleAtualizado)
  }, [imovelId])

  const toggleFavorito = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (carregando) return

    try {
      setCarregando(true)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        abrirModalLogin('Entre para salvar imóveis favoritos')
        return
      }

      if (favoritado) {
        // Remover favorito
        await supabase
          .from('favoritos')
          .delete()
          .eq('usuario_id', session.user.id)
          .eq('imovel_id', imovelId)
        setFavoritado(false)
        window.dispatchEvent(new CustomEvent('fixum:favoritoAtualizado', { detail: { imovelId, favoritado: false } }))
      } else {
        // Adicionar favorito
        await supabase
          .from('favoritos')
          .insert({ usuario_id: session.user.id, imovel_id: imovelId })
        setFavoritado(true)
        window.dispatchEvent(new CustomEvent('fixum:favoritoAtualizado', { detail: { imovelId, favoritado: true } }))
      }
    } catch (err) {
      console.error('[useFavorito] Erro:', err)
    } finally {
      setCarregando(false)
    }
  }, [favoritado, carregando, imovelId, abrirModalLogin]) // eslint-disable-line react-hooks/exhaustive-deps

  return { favoritado, toggleFavorito, carregando }
}
