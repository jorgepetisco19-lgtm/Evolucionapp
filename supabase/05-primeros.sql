-- =====================================================================
-- Evolucionapp · añadido 5: la etiqueta "primer plato" para las recetas (v10).
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run. Es seguro ejecutarlo más de una vez.
-- Requiere haber ejecutado antes 03-menu.sql (el 04 no hace falta: este lo incluye). No toca ni borra ninguna receta.
-- =====================================================================

alter table public.recipes drop constraint if exists recipes_meal_types_check;
alter table public.recipes
  add constraint recipes_meal_types_check
  check (meal_types <@ array['breakfast', 'lunch', 'snack', 'dinner', 'starter', 'side']::text[]);
