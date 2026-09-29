-- Klienci składają zamówienia tylko przez place_order() (numer nadaje baza)
drop policy if exists "Klient może złożyć zamówienie" on public.orders;
