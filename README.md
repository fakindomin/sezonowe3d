# sezonowe3d
Strona do obsługi zamówień na wydruki 3d: sklep dla klientów i panel warsztatowy (`#admin`).

## Pliki
- `index.html` – sklep i panel admina (cały kod strony)
- `polityka-prywatnosci.html` – polityka prywatności
- `regulamin.html` – regulamin sklepu (sprzedawca, zamówienia, odbiór osobisty, zwroty, reklamacje)
- `formularz-odstapienia.html` – wzór formularza odstąpienia od umowy (do druku)
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

i zatwierdzić zmieniony `tailwind.css` oraz pliki HTML: polecenie dopisuje do linku stylów wersję (`tailwind.css?v=...`),
żeby przeglądarki nie trzymały starych stylów w pamięci.

## Na wymiar (`na-wymiar/`)
Zakładka z modelami w wymiarach klienta: haczyki, uchwyty, doniczka, tabliczka. Jest domyślnie włączona;
wyłącza się ją w panelu: Ustawienia → Dostępność Kolekcji → „Na wymiar”.
- `na-wymiar/model3d.js` – podgląd 3D, waga, czas druku i plik 3MF; budowany w repozytorium
  modelowanie3d poleceniem `npm run build:lite` (plik `dist-lite/model3d.js`), nie edytować ręcznie
- `na-wymiar/*.webp` – zdjęcia na kafelki
- cena za sztukę: `CUSTOM_PRICING` w `index.html` (zł za gram + zł za godzinę druku, cena minimalna)
- pozycja zamówienia ma pole `custom` (model, wymiary, waga, czas); w panelu przy takiej pozycji
  jest przycisk „⬇ 3MF”, który zapisuje plik w wymiarach z zamówienia
- tabliczka do roślin ma dwa kolory (tabliczka i napis, w zamówieniu „Biały, napis Zielony”); jej 3MF
  to jeden obiekt z dwiema częściami nazwanymi kolorami, więc w Bambu Studio każdej części
  przypisujesz filament z AMS (albo zmiana filamentu na wysokości 2 mm)

## Produkty w sklepie (edytor w panelu)
Panel → Ustawienia → „🛍️ Produkty w sklepie”. Tam dodajesz, ukrywasz, przestawiasz i usuwasz produkty,
zmieniasz opisy, ceny (jedna cena, rozmiary albo komplet), kolory i zdjęcia (główne i osobne dla koloru),
a także paletę kolorów i cennik akcesoriów na wymiar.
- zdjęcia są same zmniejszane do 800 px (domyślnie na biały kwadrat) i trafiają do Supabase Storage (`product-images`);
  każdy kolor może mieć kilka zdjęć (w sklepie strzałki, kropki i przesuwanie palcem)
- nazwy produktu nie da się zmienić, dopóki aktywne zamówienia mają starą nazwę
- Dynia, Lisek i Wiewiórka mają zablokowaną nazwę (używa ich Zestaw Jesienny); zestaw i akcesoria
  na wymiar mają tylko opis, cenę, zdjęcie i widoczność
- gdy baza nie odpowie, sklep pokazuje katalog zapisany w kodzie (`index.html`)
- „Mix kolorów” zaznaczasz w edytorze na liście kolorów produktu (gdy ma co najmniej 2 kolory); w zamówieniu
  zostaje kolor „Mix kolorów”, a planer i pakowanie rozkładają sztuki po kolei na kolory produktu

## Statystyki w menu głównym
Przychód, koszty i zysk liczą się z zamówień odhaczonych jako zapłacone. Przycisk „🔄 Zeruj (nowy sezon)”
zapamiętuje dzień startu (w `app_state.costs.statsSince`) i od tej pory liczy tylko płatności od tego dnia.
„Pokaż wszystko” cofa zerowanie. Zamówienia i płatności nie są usuwane.

## Zdjęcia
Zdjęcie w banerze kolekcji (po prawej, płynnie przechodzi w kolor banera): pole `bannerImg` kolekcji w `CATALOG`
w `index.html`, np. `baner_zima.webp` (ok. 1400 px szerokości).
Zdjęcia produktów mają 800×800 px (WebP). Edytor produktów zmniejsza je sam.

## Baza (Supabase)
- `orders` – zamówienia; klienci dodają je tylko przez funkcję `place_order()`,
  czytać i zmieniać może tylko admin
- `app_state` – wspólny stan warsztatu (sezony, półka, szpule, ustawienia, pakowanie)
- `products`, `shop_settings` – katalog sklepu, paleta kolorów i cennik akcesoriów (czyta każdy, zmienia admin)
- `admins` – e-maile kont z dostępem do panelu (konta zakłada się w Supabase: Authentication → Users)

## Powiadomienia e-mail o zamówieniach
Po zamówieniu klienta funkcja `place_order()` wywołuje funkcję Edge `order-notify`
(`supabase/functions/order-notify/`), która wysyła maila przez EmailJS z prywatnym kluczem.
- klucz prywatny EmailJS jest w Supabase: Edge Functions → Secrets → `EMAILJS_PRIVATE_KEY`
- EmailJS (Account → Security) ma włączone „Allow EmailJS API for non-browser applications”
  i „Use Private Key”, więc bez klucza prywatnego nie da się wysłać maila
- `orders.notified_at` zapisuje, kiedy wyszedł mail; każde zamówienie jest wysyłane najwyżej raz
- zamówienia ręczne z panelu nie wysyłają maila
- klient może podać e-mail (`orders.email`); wtedy dostaje potwierdzenie zamówienia z osobnego szablonu
  EmailJS `template_szv564o` (stała w kodzie funkcji; sekret `EMAILJS_CUSTOMER_TEMPLATE_ID` może ją nadpisać; szablon: To Email `{{to_email}}`,
  Subject `{{subject}}`, Reply To `{{reply_to}}`, treść `{{{message_html}}}`); `orders.customer_notified_at`
  zapisuje, kiedy wyszedł

## Wysyłka do Paczkomatu InPost
- klient wybiera w koszyku „Odbiór osobisty” albo „Paczkomat InPost”; Paczkomat szuka po miejscowości (z ulicą),
  kodzie pocztowym, kodzie Paczkomatu albo „📍 Blisko” (publiczna baza punktów `api-pl-points.easypack24.net`,
  bez konta); gdy wyszukiwarka nie działa, można użyć wpisanego kodu Paczkomatu
- ustawienia (włącz/wyłącz, cena, telefon do BLIK): panel → Produkty w sklepie → Wysyłka do Paczkomatu
  (tabela `shop_shipping`); koszt wysyłki dolicza baza w `place_order`, nie przeglądarka
- zamówienie ma pola `delivery` (`pickup`/`inpost`), `locker_code`, `locker_address`, `shipping_cost`;
  kwota „Do zapłaty” zawiera wysyłkę, przychód w statystykach – nie
- klient płaci BLIKiem z góry w 3 dni (dane w mailu i na ekranie po zamówieniu); paczkę nadajesz w aplikacji InPost,
  kopiując kod Paczkomatu, telefon, e-mail i imię z karty zamówienia; nieopłacone zamówienia usuwasz ręcznie
- podpowiedzi przy wpisywaniu (miejscowości i kody Paczkomatów, także bez polskich znaków) korzystają ze spisu
  `public-data/inpost/index.json` w Supabase Storage; buduje go funkcja `inpost-index` co poniedziałek o 3:17
  (pg_cron `inpost-index-weekly`); bez spisu wyszukiwarka działa jak wcześniej
