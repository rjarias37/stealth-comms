-- ============================================================
-- Squadar — Hardening de privacidad (aprobado por Raymond)
-- Retencion: 24 horas
-- ============================================================

-- 1. Defensa en profundidad: veto de payloads peligrosos
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_no_payload_peligroso;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_no_payload_peligroso
  CHECK (
    content !~* '<\s*script'
    AND content !~* 'javascript:'
  );

-- 2. Borrado automatico cada hora de los mensajes con mas de 24h
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-messages-24h',
  '0 * * * *',
  $$DELETE FROM public.messages WHERE created_at < now() - interval '24 hours'$$
);

-- Verificacion:
-- SELECT jobname, schedule FROM cron.job;
-- SELECT count(*) FROM public.messages;
