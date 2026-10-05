-- =====================================================================
-- FIXUM — Cache dos lugares próximos ("O que tem no entorno?")
-- (rodar no SQL Editor do Supabase)
-- =====================================================================
-- A página do imóvel mostra supermercados, farmácias, escolas etc. por perto.
-- Esses dados vêm do OpenStreetMap (Overpass), que é lento e às vezes fica fora
-- do ar. Esta tabela guarda o resultado por endereço: a primeira visita calcula,
-- as próximas leem daqui na hora. O servidor refaz o cálculo a cada 30 dias.
--
-- Só o servidor (service_role) lê e grava; o site e o app não acessam direto.
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.entorno_cache (
  chave         text        PRIMARY KEY,          -- "lat_lng" com 4 casas decimais (~11 m)
  dados         jsonb       NOT NULL,             -- { "categorias": { "supermercados": [...], ... } }
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entorno_cache ENABLE ROW LEVEL SECURITY;
-- Sem políticas de acesso: com RLS ligado, anon e authenticated não leem nem gravam.
REVOKE ALL ON public.entorno_cache FROM anon, authenticated;
