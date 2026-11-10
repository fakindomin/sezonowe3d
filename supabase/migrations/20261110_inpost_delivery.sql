-- Dostawa do Paczkomatu InPost: ustawienia wysyłki i dane dostawy w zamówieniu
create table if not exists public.shop_shipping (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  price numeric(10,2) not null default 15 check (price >= 0 and price <= 1000),
  blik_phone text check (blik_phone is null or blik_phone ~ '^[0-9 +]{9,16}$'),
  updated_at timestamptz not null default now()
);
insert into public.shop_shipping (id, enabled, price) values (true, true, 15) on conflict (id) do nothing;

alter table public.shop_shipping enable row level security;
create policy "Każdy widzi ustawienia wysyłki" on public.shop_shipping for select to anon, authenticated using (true);
create policy "Admin zmienia ustawienia wysyłki" on public.shop_shipping for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
alter publication supabase_realtime add table public.shop_shipping;

alter table public.orders add column if not exists delivery text not null default 'pickup' check (delivery in ('pickup', 'inpost'));
alter table public.orders add column if not exists locker_code text check (locker_code is null or locker_code ~ '^[A-Z0-9-]{3,16}$');
alter table public.orders add column if not exists locker_address text check (locker_address is null or char_length(locker_address) <= 200);
alter table public.orders add column if not exists shipping_cost numeric(10,2) not null default 0 check (shipping_cost >= 0);

-- Składanie zamówienia z wyborem dostawy; koszt wysyłki bierze baza z ustawień (nie z przeglądarki).
-- Starsze wersje place_order (4 i 5 argumentów) zostają dla starych kart przeglądarki i zamówień ręcznych.
create or replace function public.place_order(
  p_customer text, p_contact text, p_email text, p_notes text, p_items jsonb,
  p_delivery text, p_locker_code text, p_locker_address text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_delivery text := coalesce(nullif(trim(p_delivery), ''), 'pickup');
  v_code text := nullif(upper(trim(coalesce(p_locker_code, ''))), '');
  v_address text := nullif(trim(coalesce(p_locker_address, '')), '');
  v_phone text := regexp_replace(coalesce(p_contact, ''), '[^0-9]', '', 'g');
  v_cost numeric(10,2) := 0;
  v_enabled boolean;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or exists (
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

  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Nieprawidłowy adres e-mail';
  end if;

  if v_delivery not in ('pickup', 'inpost') then
    raise exception 'Nieprawidłowy sposób dostawy';
  end if;

  if v_delivery = 'inpost' then
    select enabled, price into v_enabled, v_cost from public.shop_shipping where id;
    if not coalesce(v_enabled, false) then
      raise exception 'Wysyłka do Paczkomatu jest teraz niedostępna';
    end if;
    if v_code is null or v_code !~ '^[A-Z0-9-]{3,16}$' then
      raise exception 'Wybierz Paczkomat';
    end if;
    if v_email is null then
      raise exception 'Do wysyłki potrzebny jest adres e-mail';
    end if;
    if not (v_phone ~ '^[0-9]{9}$' or v_phone ~ '^48[0-9]{9}$') then
      raise exception 'Do wysyłki potrzebny jest numer telefonu komórkowego (9 cyfr)';
    end if;
  else
    v_code := null;
    v_address := null;
  end if;

  v_id := nextval('public.order_number_seq')::text;

  insert into public.orders (id, customer, contact, email, notes, status, items, notified_at,
                             delivery, locker_code, locker_address, shipping_cost)
  values (
    v_id, trim(p_customer), trim(p_contact), v_email, nullif(trim(p_notes), ''), 'W kolejce', p_items,
    case when (select private.is_admin()) then now() end,
    v_delivery, v_code, left(v_address, 200), coalesce(v_cost, 0)
  );

  if not (select private.is_admin()) then
    perform net.http_post(
      url := 'https://ohtlirhvjhvzefkcxqfu.supabase.co/functions/v1/order-notify',
      body := jsonb_build_object('orderId', v_id)
    );
  end if;

  return v_id;
end;
$$;

revoke execute on function public.place_order(text, text, text, text, jsonb, text, text, text) from public;
grant execute on function public.place_order(text, text, text, text, jsonb, text, text, text) to anon, authenticated;

-- Numer telefonu do BLIK (ustawiany też w panelu: Produkty w sklepie → Wysyłka do Paczkomatu)
update public.shop_shipping set blik_phone = '665 532 647' where id and blik_phone is null;
