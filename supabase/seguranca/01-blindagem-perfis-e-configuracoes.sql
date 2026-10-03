-- =====================================================================
-- FIXUM — Blindagem de segurança (rodar no SQL Editor do Supabase)
-- =====================================================================
-- 1) Impede que um usuário comum se promova a admin pelo próprio perfil
--    (o front faz upsert em public.perfis com a anon key).
-- 2) Fecha a leitura pública das credenciais do Asaas em configuracoes_sistema.
-- Pode ser executado mais de uma vez (idempotente).
-- =====================================================================

-- ── 1. Campos privilegiados de public.perfis ──────────────────────────
CREATE OR REPLACE FUNCTION public.proteger_campos_privilegiados_perfis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (rotas /api do servidor) e o SQL Editor podem tudo
  IF coalesce(auth.role(), '') = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_admin := false;
    IF NEW.tipo = 'admin' THEN
      NEW.tipo := 'proprietario';
    END IF;
    NEW.status_conta := 'ativo';
    RETURN NEW;
  END IF;

  -- UPDATE: estes campos só mudam pelo servidor
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'Alteração de is_admin não permitida.' USING ERRCODE = '42501';
  END IF;
  IF NEW.tipo = 'admin' AND OLD.tipo IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Alteração para tipo admin não permitida.' USING ERRCODE = '42501';
  END IF;
  IF NEW.status_conta IS DISTINCT FROM OLD.status_conta THEN
    RAISE EXCEPTION 'Alteração de status_conta não permitida.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_campos_privilegiados_perfis ON public.perfis;
CREATE TRIGGER trg_proteger_campos_privilegiados_perfis
  BEFORE INSERT OR UPDATE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.proteger_campos_privilegiados_perfis();

-- ── 2. configuracoes_sistema: credenciais fora da leitura pública ─────
-- Antes: "Leitura pública" com USING (true) expunha asaas_api_key e asaas_webhook_token
-- para qualquer visitante com a anon key.
DROP POLICY IF EXISTS "Leitura pública de configuracoes" ON public.configuracoes_sistema;
CREATE POLICY "Leitura pública de configuracoes"
  ON public.configuracoes_sistema FOR SELECT
  USING (chave NOT LIKE 'asaas_%');

-- A política "Admin edita configuracoes" (FOR ALL, is_admin = true) continua valendo,
-- então o painel admin segue lendo e gravando as chaves do Asaas normalmente.

-- ── Conferência ──────────────────────────────────────────────────────
-- SELECT chave FROM public.configuracoes_sistema;  -- como anon: não deve listar asaas_*
