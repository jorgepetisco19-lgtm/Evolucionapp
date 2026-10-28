-- =====================================================================
-- Evolucionapp · añadido 8: importar entrenos de Health Connect (v13, solo APK).
-- Añade el identificador del entreno en Health Connect, para no importar dos veces el mismo.
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run. Es seguro ejecutarlo más de una vez.
-- No borra ni cambia ningún entreno existente. (Ya está incluido también en schema.sql.)
-- =====================================================================

alter table public.workouts
  add column if not exists external_id text check (external_id is null or char_length(external_id) <= 200);

create unique index if not exists workouts_external_id_uidx
  on public.workouts (user_id, external_id) where external_id is not null;
