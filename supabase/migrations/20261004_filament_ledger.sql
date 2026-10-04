-- Rozliczenie filamentów: osobny notatnik admina, niepowiązany z resztą panelu
create table if not exists public.filament_purchases (
  id bigint generated always as identity primary key,
  bought_on date not null default current_date,
  name text not null check (char_length(name) between 1 and 120),
  spools integer not null default 1 check (spools between 1 and 1000),
  unit_price numeric(10,2) not null check (unit_price >= 0 and unit_price <= 100000),
  created_at timestamptz not null default now()
);

create table if not exists public.filament_payments (
  id bigint generated always as identity primary key,
  paid_on date not null default current_date,
  amount numeric(10,2) not null check (amount > 0 and amount <= 1000000),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

alter table public.filament_purchases enable row level security;
alter table public.filament_payments enable row level security;

create policy "Admin zarządza zakupami filamentów"
  on public.filament_purchases for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Admin zarządza wpłatami za filamenty"
  on public.filament_payments for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Synchronizacja na żywo między telefonami adminów
alter publication supabase_realtime add table public.filament_purchases, public.filament_payments;
