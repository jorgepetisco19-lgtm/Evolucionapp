-- =====================================================================
-- Evolucionapp · añadido 10: borrar mi cuenta y mis datos (v17).
-- Crea la función delete_my_account(), que usa el botón «Borrar mi cuenta y mis datos» de Ajustes.
-- Borra tu usuario; como todas tus tablas están enlazadas a él con «on delete cascade», se borran con él
-- pesos, medidas, fotos (la lista), rutinas, entrenos, recetas, comidas, ingredientes y perfil.
-- (Los archivos de las fotos los borra antes la propia app.)
-- Solo puede borrar a QUIEN LA LLAMA (auth.uid()); nadie puede borrar la cuenta de otra persona.
-- delete_my_account(true) es un «ensayo»: comprueba que todo está listo y no borra nada (la app lo usa antes de tocar tus fotos).
-- Pégalo ENTERO en Supabase → SQL Editor → New query → Run. Es seguro ejecutarlo más de una vez.
-- No borra nada por sí solo: solo crea la función. (Ya está incluido también en schema.sql.)
-- =====================================================================

create or replace function public.delete_my_account(dry_run boolean default false)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Hay que iniciar sesión para borrar la cuenta' using errcode = '28000';
  end if;
  if dry_run then
    return;
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- Si ya habías ejecutado una versión anterior sin «dry_run», se quita para que no haya dos funciones con el mismo nombre.
drop function if exists public.delete_my_account();

revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.delete_my_account(boolean) to authenticated;
