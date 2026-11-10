-- Spis Paczkomatów do podpowiedzi w sklepie: publiczny plik public-data/inpost/index.json
-- budowany przez funkcję inpost-index (supabase/functions/inpost-index) raz w tygodniu.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-data', 'public-data', true, 5242880, array['application/json'])
on conflict (id) do nothing;

create extension if not exists pg_cron;
select cron.schedule(
  'inpost-index-weekly',
  '17 3 * * 1',
  $$select net.http_post(url := 'https://ohtlirhvjhvzefkcxqfu.supabase.co/functions/v1/inpost-index', body := '{}'::jsonb, timeout_milliseconds := 150000)$$
);
