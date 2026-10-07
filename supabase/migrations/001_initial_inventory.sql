begin;

create sequence public.entry_reference_seq
  as bigint
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  no cycle;

create sequence public.exit_reference_seq
  as bigint
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  no cycle;

revoke all on sequence public.entry_reference_seq from public, anon, authenticated;
revoke all on sequence public.exit_reference_seq from public, anon, authenticated;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'طرد',
  low_stock_threshold integer not null default 0,
  sku text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_empty check (btrim(name) <> ''),
  constraint products_unit_not_empty check (btrim(unit) <> ''),
  constraint products_low_stock_threshold_nonnegative check (low_stock_threshold >= 0),
  constraint products_sku_not_empty check (sku is null or btrim(sku) <> '')
);

create index products_active_idx on public.products (active);
create index products_name_idx on public.products (name);
create unique index products_sku_unique_idx
  on public.products (lower(btrim(sku)))
  where sku is not null;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'employee',
  created_at timestamptz not null default now(),
  constraint profiles_display_name_not_empty check (btrim(display_name) <> ''),
  constraint profiles_role_valid check (role in ('manager', 'employee'))
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  product_id uuid not null references public.products (id) on delete restrict,
  type text not null,
  quantity integer not null,
  party text not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete restrict,
  constraint stock_movements_reference_unique unique (reference),
  constraint stock_movements_type_valid check (type in ('entry', 'exit')),
  constraint stock_movements_quantity_positive check (quantity > 0),
  constraint stock_movements_party_not_empty check (btrim(party) <> '')
);

create index stock_movements_product_created_idx
  on public.stock_movements (product_id, created_at desc);
create index stock_movements_created_at_idx
  on public.stock_movements (created_at desc);
create index stock_movements_type_idx
  on public.stock_movements (type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.role = 'manager'
  );
$$;

revoke all on function public.is_manager() from public, anon;
grant execute on function public.is_manager() to authenticated;

create or replace function public.guard_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Profile IDs cannot be changed.';
  end if;

  if new.role is distinct from old.role then
    if old.id = auth.uid() then
      raise exception 'Users cannot change their own role.';
    end if;

    if auth.uid() is not null and not public.is_manager() then
      raise exception 'Only a manager can change another user role.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_updates() from public, anon, authenticated;

create trigger profiles_guard_updates
before update on public.profiles
for each row
execute function public.guard_profile_updates();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := nullif(
    btrim(left(new.raw_user_meta_data ->> 'display_name', 120)),
    ''
  );

  insert into public.profiles (id, display_name)
  values (new.id, coalesce(v_display_name, 'مستخدم جديد'));

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create or replace function public.create_stock_movement(
  p_product_id uuid,
  p_type text,
  p_quantity integer,
  p_party text,
  p_note text default null
)
returns public.stock_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_active boolean;
  v_current_stock bigint;
  v_reference_number bigint;
  v_reference text;
  v_movement public.stock_movements;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_user_id
  ) then
    raise exception 'A profile is required to create a stock movement.';
  end if;

  if p_type is null or p_type not in ('entry', 'exit') then
    raise exception 'Movement type must be entry or exit.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_party is null or btrim(p_party) = '' then
    raise exception 'Party must not be empty.';
  end if;

  select product.active
  into v_product_active
  from public.products as product
  where product.id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found.';
  end if;

  if not v_product_active then
    raise exception 'Inactive products cannot receive stock movements.';
  end if;

  select coalesce(
    sum(
      case movement.type
        when 'entry' then movement.quantity
        when 'exit' then -movement.quantity
        else 0
      end
    ),
    0
  )
  into v_current_stock
  from public.stock_movements as movement
  where movement.product_id = p_product_id;

  if p_type = 'exit' and p_quantity > v_current_stock then
    raise exception using
      errcode = 'P0001',
      message = 'الكمية المطلوبة أكبر من المخزون المتوفر.';
  end if;

  if p_type = 'entry' then
    v_reference_number := nextval('public.entry_reference_seq'::regclass);
    v_reference := 'ENT-' || lpad(
      v_reference_number::text,
      greatest(4, length(v_reference_number::text)),
      '0'
    );
  else
    v_reference_number := nextval('public.exit_reference_seq'::regclass);
    v_reference := 'SOR-' || lpad(
      v_reference_number::text,
      greatest(4, length(v_reference_number::text)),
      '0'
    );
  end if;

  insert into public.stock_movements (
    reference,
    product_id,
    type,
    quantity,
    party,
    note,
    created_by
  )
  values (
    v_reference,
    p_product_id,
    p_type,
    p_quantity,
    btrim(p_party),
    nullif(btrim(p_note), ''),
    v_user_id
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

revoke all on function public.create_stock_movement(uuid, text, integer, text, text)
  from public, anon;
grant execute on function public.create_stock_movement(uuid, text, integer, text, text)
  to authenticated;

create view public.product_stock
with (security_invoker = true)
as
select
  product.id as product_id,
  product.name,
  product.unit,
  product.low_stock_threshold,
  coalesce(
    sum(
      case movement.type
        when 'entry' then movement.quantity
        when 'exit' then -movement.quantity
        else 0
      end
    ),
    0
  )::bigint as current_stock,
  product.active
from public.products as product
left join public.stock_movements as movement
  on movement.product_id = product.id
group by
  product.id,
  product.name,
  product.unit,
  product.low_stock_threshold,
  product.active;

alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.stock_movements enable row level security;

revoke all on table public.products from public, anon, authenticated;
grant select on table public.products to authenticated;
grant insert (name, unit, low_stock_threshold, sku, active)
  on table public.products to authenticated;
grant update (name, unit, low_stock_threshold, sku, active)
  on table public.products to authenticated;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, role) on table public.profiles to authenticated;

revoke all on table public.stock_movements from public, anon, authenticated;
grant select on table public.stock_movements to authenticated;

revoke all on table public.product_stock from public, anon, authenticated;
grant select on table public.product_stock to authenticated;

create policy products_select_authenticated
on public.products
for select
to authenticated
using (true);

create policy products_insert_manager
on public.products
for insert
to authenticated
with check (public.is_manager());

create policy products_update_manager
on public.products
for update
to authenticated
using (public.is_manager())
with check (public.is_manager());

create policy profiles_select_self_or_manager
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_manager());

create policy profiles_update_self_or_manager
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_manager())
with check (id = auth.uid() or public.is_manager());

create policy stock_movements_select_authenticated
on public.stock_movements
for select
to authenticated
using (true);

commit;
