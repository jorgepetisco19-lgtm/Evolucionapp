-- =====================================================================
-- Evolucionapp · añadido 7: datos del reloj en los entrenos (v12).
-- Añade calorías, pulsaciones (media y máxima), distancia y de dónde viene el dato, y los tipos Correr, Bici y Natación.
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run. Es seguro ejecutarlo más de una vez.
-- No borra ni cambia ningún entreno existente. (Ya está incluido también en schema.sql.)
-- =====================================================================

alter table public.workouts
  add column if not exists calories_kcal integer check (calories_kcal between 0 and 20000),
  add column if not exists hr_avg smallint check (hr_avg between 30 and 250),
  add column if not exists hr_max smallint check (hr_max between 30 and 250),
  add column if not exists distance_km numeric(6,2) check (distance_km between 0 and 1000),
  add column if not exists source text not null default 'manual';

alter table public.workouts drop constraint if exists workouts_source_check;
alter table public.workouts
  add constraint workouts_source_check check (source in ('manual', 'capture', 'health_connect'));   -- a mano, leído de una captura o (más adelante) de Health Connect

alter table public.workouts drop constraint if exists workouts_hr_order_check;
alter table public.workouts
  add constraint workouts_hr_order_check check (hr_avg is null or hr_max is null or hr_avg <= hr_max);

alter table public.workouts drop constraint if exists workouts_type_check;
alter table public.workouts
  add constraint workouts_type_check check (type in ('gym', 'padel', 'walk', 'run', 'cycling', 'swim', 'other'));
