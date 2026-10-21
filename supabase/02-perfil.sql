-- =====================================================================
-- Evolucionapp · añadido 2: tabla del perfil. Pégalo ENTERO en Supabase → SQL Editor → New query → Run.
-- Es seguro ejecutarlo más de una vez. (Ya está incluido también en schema.sql.)
-- =====================================================================

-- ---------- Perfil (de dónde partes) para calcular el metabolismo basal y el objetivo de kcal ----------
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  sex text check (sex in ('male', 'female')),
  birth_date date,
  height_cm numeric(5,1) check (height_cm between 80 and 250),
  weight_kg numeric(5,1),                                      -- solo se usa si aún no hay ningún peso registrado
  activity text check (activity in ('sedentary', 'light', 'moderate', 'high', 'athlete')),
  goal text check (goal in ('lose', 'maintain', 'gain')),
  pace numeric(3,2),                                           -- kg por semana
  goal_weight_kg numeric(5,1),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['profiles']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t);
  end loop;
end $$;
