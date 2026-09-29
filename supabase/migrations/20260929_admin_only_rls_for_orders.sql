-- Lista adminów (niewidoczna przez API: RLS bez polityk)
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;
insert into public.admins (email) values ('sezonowe3d@gmail.com') on conflict do nothing;

-- Czy zalogowany użytkownik jest potwierdzonym adminem
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
  );
$$;

-- Walidacja danych zamówień
alter table public.orders
  add constraint orders_id_format check (id ~ '^[0-9]{1,12}$'),
  add constraint orders_customer_len check (char_length(customer) between 1 and 200),
  add constraint orders_contact_len check (char_length(contact) between 1 and 200),
  add constraint orders_notes_len check (notes is null or char_length(notes) <= 1000),
  add constraint orders_items_array check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100);

-- Nowe reguły dostępu
drop policy if exists "Anonimowy klient może dodać zamówienie" on public.orders;
drop policy if exists "Dostęp do zamówień dla admina" on public.orders;

create policy "Klient może złożyć zamówienie"
  on public.orders for insert
  to anon, authenticated
  with check (status = 'W kolejce');

create policy "Admin czyta zamówienia"
  on public.orders for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admin dodaje zamówienia"
  on public.orders for insert
  to authenticated
  with check ((select public.is_admin()));

create policy "Admin edytuje zamówienia"
  on public.orders for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admin usuwa zamówienia"
  on public.orders for delete
  to authenticated
  using ((select public.is_admin()));
