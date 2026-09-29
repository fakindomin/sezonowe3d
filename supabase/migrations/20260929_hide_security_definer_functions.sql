-- is_admin() poza schematem wystawionym przez API (polityki odwołują się po OID, więc działają dalej)
create schema if not exists private;
grant usage on schema private to anon, authenticated;
alter function public.is_admin() set schema private;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Funkcja event triggera nie musi być wywoływalna przez API
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
