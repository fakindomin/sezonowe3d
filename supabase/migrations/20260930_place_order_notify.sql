-- Po zamówieniu klienta baza wywołuje funkcję order-notify, która wysyła e-mail do pracowni.
-- Zamówienia ręczne admina nie wysyłają maila.
-- Składanie zamówienia: numer nadaje baza, status zawsze "W kolejce"
create or replace function public.place_order(
  p_customer text,
  p_contact text,
  p_notes text,
  p_items jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
begin
  if jsonb_typeof(p_items) <> 'array' or exists (
    select 1
    from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
      or jsonb_typeof(e->'title') <> 'string'
      or char_length(e->>'title') not between 1 and 100
      or (e ? 'color' and jsonb_typeof(e->'color') not in ('string', 'null'))
      or char_length(coalesce(e->>'color', '')) > 50
      or jsonb_typeof(e->'qty') <> 'number'
      or (e->>'qty')::numeric not between 1 and 999
      or (e->>'qty')::numeric <> trunc((e->>'qty')::numeric)
      or (e ? 'unitPrice' and (jsonb_typeof(e->'unitPrice') <> 'number' or (e->>'unitPrice')::numeric not between 0 and 10000))
  ) then
    raise exception 'Nieprawidłowe pozycje zamówienia';
  end if;

  v_id := nextval('public.order_number_seq')::text;

  insert into public.orders (id, customer, contact, notes, status, items, notified_at)
  values (
    v_id, trim(p_customer), trim(p_contact), nullif(trim(p_notes), ''), 'W kolejce', p_items,
    case when (select private.is_admin()) then now() end
  );

  -- Wysyłka po zatwierdzeniu transakcji (pg_net działa asynchronicznie)
  if not (select private.is_admin()) then
    perform net.http_post(
      url := 'https://ohtlirhvjhvzefkcxqfu.supabase.co/functions/v1/order-notify',
      body := jsonb_build_object('orderId', v_id)
    );
  end if;

  return v_id;
end;
$$;

revoke execute on function public.place_order(text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, jsonb) to anon, authenticated;
