-- =====================================================================
-- FIXUM — Exigir o app autenticador também no banco (rodar no SQL Editor do Supabase)
-- =====================================================================
-- Quem ATIVOU a verificação em duas etapas só lê/altera dados sensíveis com a sessão
-- confirmada pelo app autenticador (aal2). Quem não ativou continua igual.
-- As rotas /api já aplicam essa regra; isto cobre o acesso direto (site e app mobile).
-- Políticas RESTRICTIVE: somam-se às regras que já existem, não as substituem.
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fixum_sessao_cumpre_mfa()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors f
        WHERE f.user_id = auth.uid() AND f.status = 'verified'
      )
$$;

REVOKE ALL ON FUNCTION public.fixum_sessao_cumpre_mfa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fixum_sessao_cumpre_mfa() TO authenticated;

-- Leads e histórico de moderação: qualquer operação
DROP POLICY IF EXISTS "mfa_obrigatorio_leads" ON public.leads;
CREATE POLICY "mfa_obrigatorio_leads" ON public.leads
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.fixum_sessao_cumpre_mfa()) WITH CHECK (public.fixum_sessao_cumpre_mfa());

DROP POLICY IF EXISTS "mfa_obrigatorio_historico" ON public.historico_revisao_imoveis;
CREATE POLICY "mfa_obrigatorio_historico" ON public.historico_revisao_imoveis
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.fixum_sessao_cumpre_mfa()) WITH CHECK (public.fixum_sessao_cumpre_mfa());

-- Perfil: alterações (a leitura do próprio perfil continua liberada para a tela de login funcionar)
DROP POLICY IF EXISTS "mfa_obrigatorio_perfis_update" ON public.perfis;
CREATE POLICY "mfa_obrigatorio_perfis_update" ON public.perfis
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.fixum_sessao_cumpre_mfa()) WITH CHECK (public.fixum_sessao_cumpre_mfa());

-- Imóveis e fotos: só escrita (a leitura pública do mapa não muda)
DO $$
DECLARE t text; cmd text;
BEGIN
  FOREACH t IN ARRAY ARRAY['imoveis', 'fotos_imovel'] LOOP
    FOREACH cmd IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'mfa_obrigatorio_' || t || '_' || lower(cmd), t);
      IF cmd = 'INSERT' THEN
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.fixum_sessao_cumpre_mfa())',
                       'mfa_obrigatorio_' || t || '_insert', t);
      ELSE
        EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated USING (public.fixum_sessao_cumpre_mfa())',
                       'mfa_obrigatorio_' || t || '_' || lower(cmd), t, cmd);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ── Diagnóstico: o RLS precisa estar LIGADO nestas tabelas para as regras valerem ──
SELECT c.relname AS tabela, c.relrowsecurity AS rls_ligado
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('imoveis', 'fotos_imovel', 'leads', 'perfis', 'historico_revisao_imoveis', 'favoritos', 'assinaturas', 'faturas')
ORDER BY c.relname;
