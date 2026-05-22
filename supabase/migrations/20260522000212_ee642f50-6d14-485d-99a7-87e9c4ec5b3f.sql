
-- ===== ENUMS =====
create type public.app_role as enum ('owner','manager','waiter','kitchen','cashier','delivery');
create type public.order_status as enum ('new','preparing','ready','out_for_delivery','delivered','cancelled');
create type public.order_type as enum ('dine_in','delivery','takeout');
create type public.table_status as enum ('free','occupied','bill_requested');

-- ===== RESTAURANTS =====
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text default '#E11D2E',
  accent_color text default '#FFC93C',
  phone text,
  address text,
  settings jsonb not null default '{}'::jsonb,
  owner_id uuid not null,
  created_at timestamptz not null default now()
);
create index on public.restaurants(owner_id);

-- ===== PROFILES =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ===== USER ROLES =====
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id, role)
);
create index on public.user_roles(user_id);
create index on public.user_roles(restaurant_id);

-- ===== TABLES =====
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  number int not null,
  qr_code text not null,
  status public.table_status not null default 'free',
  created_at timestamptz not null default now(),
  unique (restaurant_id, number)
);
create index on public.tables(restaurant_id);

-- ===== CATEGORIES =====
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  image_url text,
  created_at timestamptz not null default now()
);
create index on public.categories(restaurant_id);

-- ===== PRODUCTS =====
create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  price numeric(10,2) not null default 0,
  promo_price numeric(10,2),
  available boolean not null default true,
  featured boolean not null default false,
  prep_minutes int default 15,
  addons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.products(restaurant_id);
create index on public.products(category_id);

-- ===== ORDERS =====
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  status public.order_status not null default 'new',
  type public.order_type not null default 'dine_in',
  total numeric(10,2) not null default 0,
  notes text,
  cancel_reason text,
  printed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders(restaurant_id);
create index on public.orders(table_id);
create index on public.orders(status);

-- ===== SUBORDERS (uma por cliente da mesma mesa) =====
create table public.suborders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_name text not null,
  customer_phone text,
  total numeric(10,2) not null default 0,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.suborders(order_id);

-- ===== ORDER ITEMS =====
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  suborder_id uuid references public.suborders(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  price_snapshot numeric(10,2) not null,
  quantity int not null default 1,
  notes text,
  addons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.order_items(order_id);
create index on public.order_items(suborder_id);

-- ===== NOTIFICATIONS =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications(restaurant_id, read);

-- ===== WAITER CALLS =====
create table public.waiter_calls (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  reason text not null default 'call',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.waiter_calls(restaurant_id, resolved);

-- ===== HAS_ROLE SECURITY DEFINER =====
create or replace function public.has_role(_user_id uuid, _restaurant_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and restaurant_id = _restaurant_id and role = _role
  )
$$;

create or replace function public.has_any_role_in(_user_id uuid, _restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and restaurant_id = _restaurant_id
  )
$$;

create or replace function public.current_restaurant_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.profiles where id = _user_id limit 1
$$;

-- ===== PROFILE TRIGGER =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== UPDATED_AT TRIGGER =====
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

-- ===== ENABLE RLS =====
alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.tables enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.suborders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;
alter table public.waiter_calls enable row level security;

-- ===== POLICIES =====

-- restaurants: public read (cardápio público), owner-only write
create policy "restaurants_public_read" on public.restaurants
  for select using (true);
create policy "restaurants_owner_insert" on public.restaurants
  for insert to authenticated with check (owner_id = auth.uid());
create policy "restaurants_owner_update" on public.restaurants
  for update to authenticated using (owner_id = auth.uid());
create policy "restaurants_owner_delete" on public.restaurants
  for delete to authenticated using (owner_id = auth.uid());

-- profiles: usuário lê/edita o próprio
create policy "profiles_self_read" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (id = auth.uid());
create policy "profiles_self_insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- user_roles: usuário lê os próprios; owner do restaurante gerencia
create policy "user_roles_self_read" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy "user_roles_owner_all" on public.user_roles
  for all to authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()))
  with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid()));

-- tables: público lê (cliente escaneia QR); equipe do restaurante gerencia
create policy "tables_public_read" on public.tables for select using (true);
create policy "tables_staff_write" on public.tables
  for all to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  )
  with check (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  );

-- categories: público lê; equipe gerencia
create policy "categories_public_read" on public.categories for select using (true);
create policy "categories_staff_write" on public.categories
  for all to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  )
  with check (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  );

-- products: público lê; equipe gerencia
create policy "products_public_read" on public.products for select using (true);
create policy "products_staff_write" on public.products
  for all to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  )
  with check (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  );

-- orders: público pode inserir/ler (clientes da mesa sem login); equipe pode tudo
create policy "orders_public_read" on public.orders for select using (true);
create policy "orders_public_insert" on public.orders for insert with check (true);
create policy "orders_staff_update" on public.orders
  for update to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  );
create policy "orders_staff_delete" on public.orders
  for delete to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  );

-- suborders + order_items: público insere/lê (cliente da mesa); equipe tudo
create policy "suborders_public_read" on public.suborders for select using (true);
create policy "suborders_public_insert" on public.suborders for insert with check (true);
create policy "suborders_staff_update" on public.suborders
  for update to authenticated
  using (exists (select 1 from public.orders o join public.restaurants r on r.id=o.restaurant_id
                 where o.id = order_id and (r.owner_id = auth.uid() or public.has_any_role_in(auth.uid(), r.id))));

create policy "order_items_public_read" on public.order_items for select using (true);
create policy "order_items_public_insert" on public.order_items for insert with check (true);
create policy "order_items_staff_all" on public.order_items
  for all to authenticated
  using (exists (select 1 from public.orders o join public.restaurants r on r.id=o.restaurant_id
                 where o.id = order_id and (r.owner_id = auth.uid() or public.has_any_role_in(auth.uid(), r.id))))
  with check (true);

-- notifications + waiter_calls: público pode criar; equipe lê/gerencia
create policy "notifications_staff_read" on public.notifications
  for select to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  );
create policy "notifications_any_insert" on public.notifications for insert with check (true);
create policy "notifications_staff_update" on public.notifications
  for update to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  );

create policy "waiter_calls_public_read" on public.waiter_calls for select using (true);
create policy "waiter_calls_public_insert" on public.waiter_calls for insert with check (true);
create policy "waiter_calls_staff_update" on public.waiter_calls
  for update to authenticated
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = auth.uid())
    or public.has_any_role_in(auth.uid(), restaurant_id)
  );

-- ===== REALTIME =====
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.suborders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.waiter_calls;
alter publication supabase_realtime add table public.tables;
