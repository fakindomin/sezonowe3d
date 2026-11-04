# sezonowe3d
Strona do obsługi zamówień na wydruki 3d: sklep dla klientów i panel warsztatowy (`#admin`).

## Pliki
- `index.html` – sklep i panel admina (cały kod strony)
- `polityka-prywatnosci.html` – polityka prywatności
- `tailwind.css` – zbudowane style (nie edytować ręcznie, patrz niżej)
- `supabase/migrations/` – historia zmian w bazie Supabase
- `*.webp`, `og-image.jpg`, `favicon.svg` – zdjęcia produktów, podgląd linku, ikona

## Style (Tailwind)
Style są budowane z klas użytych w plikach HTML. Po dopisaniu nowej klasy Tailwinda
(np. `bg-sky-500`), której wcześniej nie było w kodzie, trzeba przebudować CSS:

```
npm install
npm run build:css
```

i zatwierdzić zmieniony `tailwind.css`.

## Na wymiar (`na-wymiar/`)
Zakładka z modelami w wymiarach klienta: haczyki, uchwyty, doniczka, tabliczka. Jest domyślnie włączona;
wyłącza się ją w panelu: Ustawienia → Dostępność Kolekcji → „Na wymiar”.
- `na-wymiar/model3d.js` – podgląd 3D, waga, czas druku i plik 3MF; budowany w repozytorium
  modelowanie3d poleceniem `npm run build:lite` (plik `dist-lite/model3d.js`), nie edytować ręcznie
- `na-wymiar/*.webp` – zdjęcia na kafelki
- cena za sztukę: `CUSTOM_PRICING` w `index.html` (zł za gram + zł za godzinę druku, cena minimalna)
- pozycja zamówienia ma pole `custom` (model, wymiary, waga, czas); w panelu przy takiej pozycji
  jest przycisk „⬇ 3MF”, który zapisuje plik w wymiarach z zamówienia

## Zdjęcia
Zdjęcia produktów mają 800×800 px (WebP). Nowe zdjęcia warto zmniejszyć do podobnego rozmiaru
przed dodaniem, żeby strona szybko ładowała się na telefonach.

## Baza (Supabase)
- `orders` – zamówienia; klienci dodają je tylko przez funkcję `place_order()`,
  czytać i zmieniać może tylko admin
- `app_state` – wspólny stan warsztatu (sezony, półka, szpule, ustawienia, pakowanie)
- `admins` – e-maile kont z dostępem do panelu (konta zakłada się w Supabase: Authentication → Users)

## Powiadomienia e-mail o zamówieniach
Po zamówieniu klienta funkcja `place_order()` wywołuje funkcję Edge `order-notify`
(`supabase/functions/order-notify/`), która wysyła maila przez EmailJS z prywatnym kluczem.
- klucz prywatny EmailJS jest w Supabase: Edge Functions → Secrets → `EMAILJS_PRIVATE_KEY`
- EmailJS (Account → Security) ma włączone „Allow EmailJS API for non-browser applications”
  i „Use Private Key”, więc bez klucza prywatnego nie da się wysłać maila
- `orders.notified_at` zapisuje, kiedy wyszedł mail; każde zamówienie jest wysyłane najwyżej raz
- zamówienia ręczne z panelu nie wysyłają maila
