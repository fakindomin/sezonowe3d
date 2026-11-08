-- Produkty sklepu edytowane w panelu admina (Ustawienia → Produkty w sklepie)
-- Startowe produkty, paleta i cennik zostały wpisane osobno (dane, nie schemat).
create table if not exists public.products (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  collection text not null check (collection in ('easter', 'summer', 'autumn', 'christmas', 'custom')),
  kind text not null default 'simple' check (kind in ('simple', 'bundle', 'custom')),
  position integer not null default 0,
  visible boolean not null default true,
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 200),
  note text not null default '' check (char_length(note) <= 500),
  price numeric(10,2) not null default 0 check (price >= 0 and price <= 100000),
  stock_name text check (stock_name is null or char_length(stock_name) between 1 and 80),
  colors jsonb not null default '[]' check (jsonb_typeof(colors) = 'array'),
  default_color text,
  variants jsonb not null default '[]' check (jsonb_typeof(variants) = 'array'),
  set_count integer check (set_count is null or set_count between 2 and 100),
  set_piece text check (set_piece is null or char_length(set_piece) between 1 and 80),
  images jsonb not null default '{}' check (jsonb_typeof(images) = 'object'),
  visual text,
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Każdy widzi widoczne produkty"
  on public.products for select
  to anon, authenticated
  using (visible or (select private.is_admin()));

create policy "Admin zarządza produktami"
  on public.products for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Ustawienia sklepu czytane przez klientów: paleta kolorów i cennik akcesoriów na wymiar
create table if not exists public.shop_settings (
  key text primary key check (key in ('palette', 'pricing')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shop_settings enable row level security;

create policy "Każdy widzi ustawienia sklepu"
  on public.shop_settings for select
  to anon, authenticated
  using (true);

create policy "Admin zmienia ustawienia sklepu"
  on public.shop_settings for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

alter publication supabase_realtime add table public.products, public.shop_settings;

-- Zdjęcia produktów: publiczny odczyt, zapis tylko admin
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "Admin wgrywa zdjęcia produktów"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and (select private.is_admin()));

create policy "Admin zmienia zdjęcia produktów"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));

create policy "Admin usuwa zdjęcia produktów"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and (select private.is_admin()));
