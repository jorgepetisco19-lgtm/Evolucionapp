-- =====================================================================
-- Evolucionapp · añadido 11: función ping() para mantener despierto el proyecto gratuito de Supabase (v18.1).
-- La usa el workflow de GitHub «Mantener Supabase despierto»: llama a ping() cada 3 días y la base de datos
-- ejecuta una consulta de verdad (cuenta como actividad). Solo devuelve el número 1: no lee ni toca ningún dato.
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run. Es seguro ejecutarlo más de una vez.
-- (Ya está incluido también en schema.sql.)
-- =====================================================================

create or replace function public.ping()
returns integer
language sql
stable
as $$ select 1 $$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
