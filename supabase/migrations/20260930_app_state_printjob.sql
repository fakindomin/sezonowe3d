-- Bieżący druk na drukarce (wspólny dla telefonów adminów)
alter table public.app_state drop constraint if exists app_state_key_check;
alter table public.app_state add constraint app_state_key_check
  check (key in ('seasons', 'specs', 'costs', 'spools', 'shelf', 'packing', 'printjob'));
