-- =====================================================================
-- Evolucionapp · esquema de base de datos (Supabase / Postgres)
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run.
-- Es seguro ejecutarlo más de una vez.
-- Cada tabla tiene RLS (Row Level Security): cada usuario solo ve y toca sus propias filas.
-- =====================================================================

-- ---------- Pesos (composición corporal de la báscula) ----------
create table if not exists public.weigh_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric(6,2),
  bmi numeric(5,1),
  body_fat_pct numeric(5,1),
  skeletal_muscle_pct numeric(5,1),
  lean_mass_kg numeric(6,2),
  subcutaneous_fat_pct numeric(5,1),
  visceral_fat numeric(4,0),
  body_water_pct numeric(5,1),
  muscle_mass_kg numeric(6,2),
  bone_mass_kg numeric(5,2),
  protein_pct numeric(5,1),
  bmr_kcal numeric(6,0),
  metabolic_age numeric(3,0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------- Medidas con cinta (cm) ----------
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  waist_cm numeric(5,1),
  hip_cm numeric(5,1),
  chest_cm numeric(5,1),
  arm_cm numeric(5,1),
  thigh_cm numeric(5,1),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------- Fotos (el archivo vive en Storage, aquí solo la referencia) ----------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('front', 'side', 'back')),
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists photos_user_date_idx on public.photos (user_id, date);

-- ---------- Rutinas guardadas de gimnasio ----------
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  weekday smallint check (weekday between 0 and 6),          -- 0 = lunes ... 6 = domingo (opcional)
  exercises jsonb not null default '[]'::jsonb,               -- [{name, sets:[{reps, kg}]}]
  created_at timestamptz not null default now()
);

-- ---------- Entrenamientos realizados ----------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('gym', 'padel', 'walk', 'other')),
  name text,
  duration_min integer,
  notes text,
  exercises jsonb not null default '[]'::jsonb,               -- [{name, sets:[{reps, kg}]}]
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_date_idx on public.workouts (user_id, date);

-- ---------- Recetas guardadas (por ejemplo "Pollo con arroz") ----------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,                   -- [{name, grams, kcal100, p100, c100, f100}]
  created_at timestamptz not null default now()
);
alter table public.recipes
  add column if not exists meal_types text[] not null default '{}'               -- cuándo se come: breakfast, lunch, snack, dinner
  check (meal_types <@ array['breakfast', 'lunch', 'snack', 'dinner']::text[]);

-- ---------- Comidas registradas ----------
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  meal_type text not null default 'other' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  name text not null,
  recipe_id uuid references public.recipes(id) on delete set null,
  factor numeric(6,2) not null default 1,                     -- raciones (1 = la receta tal cual)
  items jsonb not null default '[]'::jsonb,
  kcal numeric(8,1) not null default 0,
  protein_g numeric(7,1) not null default 0,
  carbs_g numeric(7,1) not null default 0,
  fat_g numeric(7,1) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists meals_user_date_idx on public.meals (user_id, date);

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

-- ---------- Seguridad: RLS + permisos ----------
-- (En este proyecto "Automatically expose new tables" está desactivado, así que damos los permisos aquí.)
do $$
declare t text;
begin
  foreach t in array array['weigh_ins','measurements','photos','routines','workouts','recipes','meals','profiles']
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

-- ---------- Storage: bucket privado "photos", cada usuario en su carpeta ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "photos select own" on storage.objects;
drop policy if exists "photos insert own" on storage.objects;
drop policy if exists "photos delete own" on storage.objects;

create policy "photos select own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
