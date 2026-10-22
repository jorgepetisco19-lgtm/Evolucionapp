-- =====================================================================
-- Evolucionapp · añadido 6: tu memoria de ingredientes (v11).
-- Guarda los ingredientes que ya has completado (de Open Food Facts o escritos a mano) para no volver a esperar.
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run. Es seguro ejecutarlo más de una vez.
-- No toca ninguna tabla existente. (Ya está incluido también en schema.sql.)
-- =====================================================================

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null check (char_length(key) between 2 and 120),     -- nombre normalizado (minúsculas, sin tildes ni paréntesis)
  name text not null,                                                -- nombre tal como lo escribiste
  kcal100 numeric(7,2) not null check (kcal100 > 0 and kcal100 <= 900),
  p100 numeric(6,2) not null default 0 check (p100 between 0 and 100),
  c100 numeric(6,2) not null default 0 check (c100 between 0 and 100),
  f100 numeric(6,2) not null default 0 check (f100 between 0 and 100),
  source text not null default 'manual' check (source in ('off', 'manual')),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.ingredients enable row level security;
revoke all on table public.ingredients from anon;
grant select, insert, update, delete on table public.ingredients to authenticated;
drop policy if exists "own rows" on public.ingredients;
create policy "own rows" on public.ingredients for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
