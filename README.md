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

## Zdjęcia
Zdjęcia produktów mają 800×800 px (WebP). Nowe zdjęcia warto zmniejszyć do podobnego rozmiaru
przed dodaniem, żeby strona szybko ładowała się na telefonach.

## Baza (Supabase)
- `orders` – zamówienia; klienci dodają je tylko przez funkcję `place_order()`,
  czytać i zmieniać może tylko admin
- `app_state` – wspólny stan warsztatu (sezony, półka, szpule, ustawienia, pakowanie)
- `admins` – e-maile kont z dostępem do panelu (konta zakłada się w Supabase: Authentication → Users)
