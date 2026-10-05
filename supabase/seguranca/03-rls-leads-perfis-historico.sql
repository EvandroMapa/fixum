-- =====================================================================
-- FIXUM — RLS de leads, perfis e histórico de moderação
-- (rodar no SQL Editor do Supabase DEPOIS do 01-blindagem-perfis-e-configuracoes.sql)
-- =====================================================================
-- Situação encontrada: um visitante anônimo (só com a anon key, que é pública
-- e vai dentro do site e do APK) conseguia ler:
--   • leads inteiros (nome, telefone, e-mail de clientes)
--   • perfis inteiros (e-mail, CPF/CNPJ, notas_admin, motivo_suspensao...)
--   • histórico de moderação — e também INSERIR nele.
--
-- Depois deste script:
--   • leads: qualquer um pode CRIAR (formulário de contato); ler/alterar/excluir só
--     o dono do imóvel, o gestor da mesma imobiliária ou admin.
--   • perfis: cada um lê/edita só o próprio perfil (gestor lê a equipe; corretor lê
--     a própria imobiliária; admin lê tudo). Dados públicos de anunciantes passam a
--     vir da view perfis_publicos (sem e-mail, CPF/CNPJ ou campos administrativos).
--   • historico_revisao_imoveis: só quem gerencia o imóvel.
--
-- O vínculo com a imobiliária e o papel (gestor/corretor) são lidos de
-- auth.users.raw_app_meta_data — que só o servidor altera (mesma regra da API).
-- As rotas /api usam a service role e não são afetadas por estas políticas.
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

-- ── 0. Backup das políticas atuais (para consulta/reversão) ───────────
CREATE TABLE IF NOT EXISTS public.fixum_backup_politicas_rls AS
  SELECT now() AS salvo_em, * FROM pg_policies WHERE false;

INSERT INTO public.fixum_backup_politicas_rls
  SELECT now(), * FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('leads', 'perfis', 'historico_revisao_imoveis');

ALTER TABLE public.fixum_backup_politicas_rls ENABLE ROW LEVEL SECURITY; -- sem políticas = ninguém lê via API

-- ── 1. Funções auxiliares (SECURITY DEFINER: leem auth.users/perfis sem RLS) ──
CREATE OR REPLACE FUNCTION public.fixum_eh_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid() AND is_admin = true)
$$;

-- Imobiliária da conta: ela mesma (se for imobiliária) ou a do vínculo em app_metadata
CREATE OR REPLACE FUNCTION public.fixum_imobiliaria_de(uid uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT CASE
    WHEN coalesce((SELECT p.tipo FROM public.perfis p WHERE p.id = u.id), '') = 'imobiliaria'
      OR u.raw_user_meta_data->>'tipo' = 'imobiliaria'
      OR u.raw_user_meta_data->>'tipo_anunciante' = 'imobiliaria'
    THEN u.id
    ELSE nullif(u.raw_app_meta_data->>'imobiliaria_id', '')::uuid
  END
  FROM auth.users u
  WHERE u.id = uid
$$;

CREATE OR REPLACE FUNCTION public.fixum_eh_gestor(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT coalesce(public.fixum_imobiliaria_de(uid) = uid, false)
      OR EXISTS (
        SELECT 1 FROM auth.users u
        WHERE u.id = uid
          AND u.raw_app_meta_data->>'papel' = 'gestor'
          AND nullif(u.raw_app_meta_data->>'imobiliaria_id', '') IS NOT NULL
      )
$$;

-- O usuário logado pode gerenciar o que é deste anunciante? (ele mesmo, ou gestor da mesma equipe)
CREATE OR REPLACE FUNCTION public.fixum_pode_gerenciar_anunciante(anunciante uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    anunciante = auth.uid()
    OR (
      public.fixum_eh_gestor(auth.uid())
      AND public.fixum_imobiliaria_de(auth.uid()) IS NOT NULL
      AND public.fixum_imobiliaria_de(anunciante) = public.fixum_imobiliaria_de(auth.uid())
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.fixum_pode_gerenciar_imovel(p_imovel uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.imoveis i
    WHERE i.id = p_imovel AND public.fixum_pode_gerenciar_anunciante(i.anunciante_id)
  )
$$;

REVOKE ALL ON FUNCTION public.fixum_eh_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fixum_imobiliaria_de(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fixum_eh_gestor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fixum_pode_gerenciar_anunciante(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fixum_pode_gerenciar_imovel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fixum_eh_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fixum_imobiliaria_de(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fixum_eh_gestor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fixum_pode_gerenciar_anunciante(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fixum_pode_gerenciar_imovel(uuid) TO authenticated;

-- ── 2. Remove TODAS as políticas atuais das três tabelas ──────────────
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('leads', 'perfis', 'historico_revisao_imoveis')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_revisao_imoveis ENABLE ROW LEVEL SECURITY;

-- ── 3. LEADS ──────────────────────────────────────────────────────────
-- Formulário de contato (visitante ou logado): só cria lead novo, não lê de volta
CREATE POLICY "leads_inserir_contato" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'novo');

CREATE POLICY "leads_ler_gestao" ON public.leads
  FOR SELECT TO authenticated
  USING (public.fixum_pode_gerenciar_imovel(imovel_id) OR public.fixum_eh_admin());

CREATE POLICY "leads_alterar_gestao" ON public.leads
  FOR UPDATE TO authenticated
  USING (public.fixum_pode_gerenciar_imovel(imovel_id) OR public.fixum_eh_admin())
  WITH CHECK (public.fixum_pode_gerenciar_imovel(imovel_id) OR public.fixum_eh_admin());

CREATE POLICY "leads_excluir_gestao" ON public.leads
  FOR DELETE TO authenticated
  USING (public.fixum_pode_gerenciar_imovel(imovel_id) OR public.fixum_eh_admin());

-- ── 4. PERFIS ─────────────────────────────────────────────────────────
CREATE POLICY "perfis_ler_proprio_equipe_admin" ON public.perfis
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.fixum_eh_admin()
    OR public.fixum_pode_gerenciar_anunciante(id)          -- gestor lê a equipe
    OR id = public.fixum_imobiliaria_de(auth.uid())       -- corretor lê a própria imobiliária
  );

CREATE POLICY "perfis_criar_proprio" ON public.perfis
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Campos privilegiados (is_admin, tipo admin, status_conta) já são barrados pelo gatilho do script 01
CREATE POLICY "perfis_editar_proprio_ou_admin" ON public.perfis
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.fixum_eh_admin())
  WITH CHECK (id = auth.uid() OR public.fixum_eh_admin());

-- Dados públicos de anunciantes (página do imóvel, página da imobiliária, mapa, apps).
-- A view roda com os privilégios do dono (postgres), por isso enxerga perfis e auth.users;
-- ela expõe apenas colunas seguras. Telefone/WhatsApp só de profissionais (corretor/imobiliária).
CREATE OR REPLACE VIEW public.perfis_publicos AS
SELECT
  p.id,
  p.nome,
  p.tipo,
  p.foto_url,
  p.creci,
  p.cidade,
  p.uf,
  p.modo_exibicao_preco,
  CASE WHEN p.tipo IN ('corretor', 'imobiliaria') THEN p.telefone END AS telefone,
  CASE WHEN p.tipo IN ('corretor', 'imobiliaria') THEN p.whatsapp END AS whatsapp,
  nullif(u.raw_app_meta_data->>'imobiliaria_id', '')::uuid AS imobiliaria_id,
  CASE
    WHEN nullif(u.raw_app_meta_data->>'imobiliaria_id', '') IS NOT NULL
    THEN coalesce(u.raw_app_meta_data->>'papel', 'corretor')
  END AS papel
FROM public.perfis p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.tipo IN ('corretor', 'imobiliaria', 'proprietario');

REVOKE ALL ON public.perfis_publicos FROM PUBLIC;
GRANT SELECT ON public.perfis_publicos TO anon, authenticated;

-- ── 5. HISTÓRICO DE MODERAÇÃO ─────────────────────────────────────────
CREATE POLICY "historico_ler_gestao" ON public.historico_revisao_imoveis
  FOR SELECT TO authenticated
  USING (public.fixum_pode_gerenciar_imovel(imovel_id) OR public.fixum_eh_admin());

CREATE POLICY "historico_inserir_gestao" ON public.historico_revisao_imoveis
  FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND public.fixum_pode_gerenciar_imovel(imovel_id));

-- ── Conferência (rodar depois, opcional) ─────────────────────────────
-- SELECT tablename, policyname, cmd, roles FROM pg_policies
--   WHERE schemaname = 'public' AND tablename IN ('leads','perfis','historico_revisao_imoveis')
--   ORDER BY tablename, policyname;
