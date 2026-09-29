-- Wspólny stan warsztatu (wcześniej w localStorage każdego urządzenia)
create table if not exists public.app_state (
  key text primary key check (key in ('seasons', 'specs', 'costs', 'spools', 'shelf', 'packing')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_state enable row level security;

-- Klienci widzą tylko, które kolekcje są włączone
create policy "Każdy widzi aktywne kolekcje"
  on public.app_state for select
  to anon, authenticated
  using (key = 'seasons');

create policy "Admin zarządza stanem"
  on public.app_state for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Synchronizacja na żywo między telefonami adminów
alter publication supabase_realtime add table public.app_state;
