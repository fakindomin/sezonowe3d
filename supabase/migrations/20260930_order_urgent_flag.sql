-- Flaga "pilne": takie zamówienie ma pierwszeństwo w panelu i planerze; ustawia tylko admin
alter table public.orders add column if not exists urgent boolean not null default false;
