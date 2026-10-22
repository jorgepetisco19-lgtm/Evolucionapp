-- =====================================================================
-- Evolucionapp · añadido 3: etiquetas de comida en las recetas (para sugerir el menú del día).
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run. Es seguro ejecutarlo más de una vez.
-- (Ya está incluido también en schema.sql.)
-- =====================================================================

alter table public.recipes
  add column if not exists meal_types text[] not null default '{}'               -- cuándo se come: breakfast, lunch, snack, dinner
  check (meal_types <@ array['breakfast', 'lunch', 'snack', 'dinner']::text[]);
-- (En la v9, 04-guarniciones.sql amplía esta lista con 'side' = guarnición.)
