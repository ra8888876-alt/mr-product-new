create extension if not exists pgcrypto;

create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 description text not null default '',
 price numeric(12,2) not null check (price >= 0),
 active boolean not null default true,
 stock integer not null default 0 check (stock >= 0),
 created_at timestamptz not null default now()
);

create table if not exists public.customers (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 phone text not null,
 whatsapp text,
 district text not null,
 area text not null,
 address text not null,
 total_orders integer not null default 0,
 total_spend numeric(12,2) not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists customers_phone_address_idx on public.customers(phone, district, area);

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 order_number text not null unique,
 customer_id uuid not null references public.customers(id),
 status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
 payment_method text not null check (payment_method in ('bkash','nagad','bank')),
 subtotal numeric(12,2) not null check (subtotal >= 0),
 delivery_charge numeric(12,2) not null default 0,
 total numeric(12,2) not null check (total >= 0),
 note text,
 created_at timestamptz not null default now()
);
create table if not exists public.order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid not null references public.products(id),
 product_name text not null,
 unit_price numeric(12,2) not null,
 quantity integer not null check (quantity between 1 and 50),
 line_total numeric(12,2) not null
);
create table if not exists public.store_settings (
 id integer primary key default 1 check (id=1),
 store_name text not null default 'MR PRODUCT',
 contact_phone text,
 whatsapp text,
 logo_url text,
 updated_at timestamptz not null default now()
);

insert into public.products(id,name,description,price,active,stock) values
 ('10000000-0000-4000-8000-000000000001','Hydrating Face Serum','Daily hydration essential.',850,true,100),
 ('10000000-0000-4000-8000-000000000002','Daily Face Cream','A simple everyday skincare pick.',650,true,100),
 ('10000000-0000-4000-8000-000000000003','Luxury Lipstick','A refined finishing touch.',550,true,100)
on conflict (id) do nothing;
insert into public.store_settings(id) values(1) on conflict(id) do nothing;

alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products" on public.products for select to anon, authenticated using (active = true);
drop policy if exists "Public can view store profile" on public.store_settings;
create policy "Public can view store profile" on public.store_settings for select to anon, authenticated using (true);
-- No public INSERT/UPDATE/DELETE policies for customer or order data.
-- Only the Edge Function uses the server-side service-role key to write orders.
grant select on public.products, public.store_settings to anon, authenticated;
revoke all on public.customers, public.orders, public.order_items from anon, authenticated;

-- Remove any legacy policies on private customer/order tables before enabling writes only through the Edge Function.
do $$
declare pol record;
begin
  for pol in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('customers','orders','order_items')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;
