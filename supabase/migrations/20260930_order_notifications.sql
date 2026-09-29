-- Kiedy wysłano powiadomienie e-mail o zamówieniu (null = jeszcze nie wysłano)
alter table public.orders add column if not exists notified_at timestamptz;
update public.orders set notified_at = created_at where notified_at is null;

-- Wywołania HTTP z bazy (powiadomienia o zamówieniach)
create extension if not exists pg_net;
