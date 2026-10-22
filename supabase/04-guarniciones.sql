-- =====================================================================
-- Evolucionapp · añadido 4: la etiqueta "guarnición" para las recetas (v9).
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run. Es seguro ejecutarlo más de una vez.
-- Requiere haber ejecutado antes 03-menu.sql. No toca ni borra ninguna receta.
-- =====================================================================

alter table public.recipes drop constraint if exists recipes_meal_types_check;
alter table public.recipes
  add constraint recipes_meal_types_check
  check (meal_types <@ array['breakfast', 'lunch', 'snack', 'dinner', 'side']::text[]);
-- (En la v10, 05-primeros.sql amplía esta lista con 'starter' = primer plato; el 05 ya incluye lo del 04.)
