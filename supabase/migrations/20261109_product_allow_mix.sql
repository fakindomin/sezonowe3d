-- Produkt może mieć do wyboru „Mix kolorów” (sztuki w różnych kolorach produktu)
alter table public.products add column if not exists allow_mix boolean not null default false;
