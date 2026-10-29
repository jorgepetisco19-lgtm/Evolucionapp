-- =====================================================================
-- Evolucionapp · añadido 9: objetivo semanal de entrenos (v14).
-- Añade a tu perfil cuántos entrenos a la semana quieres hacer (para la racha y las medallas del Resumen de Deporte).
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run. Es seguro ejecutarlo más de una vez.
-- No borra ni cambia nada. (Ya está incluido también en schema.sql.)
-- Requiere que exista la tabla profiles (supabase/02-perfil.sql, que ya tienes si usas el Perfil).
-- =====================================================================

alter table public.profiles
  add column if not exists weekly_workout_goal smallint check (weekly_workout_goal between 1 and 14);
