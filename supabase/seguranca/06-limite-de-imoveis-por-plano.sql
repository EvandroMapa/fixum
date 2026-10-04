-- =====================================================================
-- FIXUM — Limite de imóveis ativos por plano, conferido no banco
-- (rodar no SQL Editor do Supabase)
-- =====================================================================
-- O site já bloqueia a publicação quando o plano está cheio, mas só na tela.
-- Quem gravasse direto no banco com a chave pública (site/app) passaria do limite.
-- Esta trava confere na hora de PUBLICAR (inserir como ativo ou mudar o status
-- para ativo). Imóveis que já estão no ar não são tocados.
--
-- Fica de fora: rotas do servidor (service_role), o SQL Editor e administradores.
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

-- Limites por plano. MANTER EM SINCRONIA com PLANOS_OFICIAIS em lib/planos.ts
CREATE OR REPLACE FUNCTION public.fixum_limite_plano(p_plano text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_plano
    WHEN 'gratis'            THEN 1
    WHEN 'inicial'           THEN 2
    WHEN 'basico'            THEN 3
    WHEN 'profissional'      THEN 10
    WHEN 'profissional_plus' THEN 20
    WHEN 'avancado'          THEN 50
    WHEN 'imobiliaria'       THEN 100
    WHEN 'imobiliaria_plus'  THEN 200
    WHEN 'enterprise'        THEN 500
    WHEN 'enterprise_plus'   THEN 99999
    ELSE 1
  END
$$;

CREATE OR REPLACE FUNCTION public.fixum_checar_limite_imoveis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_dono   text;
  v_plano  text;
  v_tipo   text;
  v_ativos integer;
  v_limite integer;
BEGIN
  -- Só confere o acesso direto de usuários logados (chave pública)
  IF coalesce(auth.jwt()->>'role', '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- Só quando o imóvel PASSA a ficar ativo
  IF NEW.status NOT IN ('ativo', 'publicado') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('ativo', 'publicado') THEN
    RETURN NEW;
  END IF;

  -- Administrador moderando anúncios
  IF EXISTS (SELECT 1 FROM public.perfis WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN NEW;
  END IF;

  -- Dono da cota: a imobiliária do corretor vinculado, ou o próprio anunciante
  SELECT coalesce(u.raw_app_meta_data->>'imobiliaria_id', u.id::text)
    INTO v_dono
    FROM auth.users u
   WHERE u.id = NEW.anunciante_id;
  v_dono := coalesce(v_dono, NEW.anunciante_id::text);

  -- Plano da conta dona (mesma regra de /api/painel/cota)
  SELECT a.plano_id
    INTO v_plano
    FROM public.assinaturas a
   WHERE a.usuario_id::text = v_dono
   ORDER BY a.created_at DESC
   LIMIT 1;

  IF v_plano IS NULL THEN
    SELECT p.tipo INTO v_tipo FROM public.perfis p WHERE p.id::text = v_dono;
    v_plano := CASE
      WHEN v_tipo IN ('imobiliaria', 'corretor') OR v_dono <> NEW.anunciante_id::text THEN 'profissional_plus'
      ELSE 'gratis'
    END;
  END IF;

  v_limite := public.fixum_limite_plano(v_plano);

  -- Imóveis ativos da conta e da equipe (sem contar este)
  SELECT count(*)
    INTO v_ativos
    FROM public.imoveis i
   WHERE i.status IN ('ativo', 'publicado')
     AND i.id IS DISTINCT FROM NEW.id
     AND (
       i.anunciante_id::text = v_dono
       OR i.anunciante_id IN (
         SELECT u.id FROM auth.users u WHERE u.raw_app_meta_data->>'imobiliaria_id' = v_dono
       )
     );

  IF v_ativos >= v_limite THEN
    RAISE EXCEPTION 'Seu plano permite até % imóvel(is) ativo(s). Pause um anúncio ou faça upgrade para publicar mais.', v_limite
      USING ERRCODE = 'P0001', HINT = 'fixum_limite_plano';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS fixum_limite_imoveis ON public.imoveis;
CREATE TRIGGER fixum_limite_imoveis
  BEFORE INSERT OR UPDATE OF status ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.fixum_checar_limite_imoveis();

-- =====================================================================
-- TESTE (rodar à parte, depois do script acima). Pega um proprietário do plano
-- grátis com 2 ou mais imóveis ativos, pausa um deles e tenta reativá-lo como se
-- fosse ele. O bloco SEMPRE termina com erro de propósito, para desfazer tudo;
-- o texto do erro diz o resultado:
--   "TESTE OK, a trava bloqueou: Seu plano permite até 1 imóvel(is)…"  → funcionando
--   "TESTE FALHOU…"                                                     → investigar
-- Executado em 2026-10-04: TESTE OK.
-- =====================================================================
-- DO $$
-- DECLARE
--   v_id   uuid;
--   v_dono uuid;
--   v_msg  text;
-- BEGIN
--   SELECT i.id, i.anunciante_id INTO v_id, v_dono
--     FROM public.imoveis i
--    WHERE i.status = 'ativo'
--      AND i.anunciante_id = (
--        SELECT i2.anunciante_id
--          FROM public.imoveis i2
--          JOIN public.perfis p ON p.id = i2.anunciante_id AND p.tipo = 'proprietario'
--          LEFT JOIN public.assinaturas a ON a.usuario_id = i2.anunciante_id
--         WHERE i2.status = 'ativo' AND coalesce(a.plano_id, 'gratis') = 'gratis'
--         GROUP BY i2.anunciante_id
--        HAVING count(*) >= 2
--         LIMIT 1)
--    LIMIT 1;
--
--   IF v_id IS NULL THEN
--     RAISE EXCEPTION 'TESTE: nenhum proprietário grátis com 2 ou mais imóveis ativos para testar';
--   END IF;
--
--   UPDATE public.imoveis SET status = 'pausado' WHERE id = v_id;   -- sem usuário: a trava não confere
--
--   PERFORM set_config('request.jwt.claims',
--     json_build_object('role', 'authenticated', 'sub', v_dono)::text, true);
--
--   BEGIN
--     UPDATE public.imoveis SET status = 'ativo' WHERE id = v_id;   -- como o usuário
--     v_msg := 'TESTE FALHOU: a trava deixou publicar além do limite';
--   EXCEPTION WHEN OTHERS THEN
--     v_msg := 'TESTE OK, a trava bloqueou: ' || SQLERRM;
--   END;
--
--   RAISE EXCEPTION '% (nada foi gravado)', v_msg;
-- END
-- $$;
