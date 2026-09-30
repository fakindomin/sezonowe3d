-- Kiedy zamówienie zostało opłacone (null = czeka na zapłatę); zmienia tylko admin
alter table public.orders add column if not exists paid_at timestamptz;
