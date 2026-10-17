begin;

do $schema$
begin
  if pg_catalog.to_regclass('public.products') is null
    or pg_catalog.to_regclass('public.stock_movements') is null
    or pg_catalog.to_regclass('public.profiles') is null
    or pg_catalog.to_regclass('public.product_stock') is null then
    raise exception
      'Expected inventory tables, profiles, and product_stock view are missing; verify migrations 005 and 006 before applying this migration.';
  end if;

  if not (
    exists (
      select 1
      from pg_catalog.pg_constraint as constraint_row
      where constraint_row.conrelid = 'public.products'::regclass
        and constraint_row.conname = 'products_fixed_catalog_name_check'
        and constraint_row.convalidated
    )
    and exists (
      select 1
      from pg_catalog.pg_trigger as trigger_row
      where trigger_row.tgrelid = 'public.products'::regclass
        and trigger_row.tgname = 'products_enforce_fixed_catalog'
        and trigger_row.tgenabled in ('O', 'A')
    )
  ) and not (
    exists (
      select 1
      from pg_catalog.pg_constraint as constraint_row
      where constraint_row.conrelid = 'public.products'::regclass
        and constraint_row.conname = 'products_category_valid'
    )
    and exists (
      select 1
      from pg_catalog.pg_trigger as trigger_row
      where trigger_row.tgrelid = 'public.products'::regclass
        and trigger_row.tgname = 'products_enforce_category_attributes'
        and trigger_row.tgenabled in ('O', 'A')
    )
  ) then
    raise exception
      'The fixed catalog from migration 005 is required before adding product categories.';
  end if;

  if exists (
    select 1
    from (
      values
        ('stock_movements', 'product_id'),
        ('profiles', 'id'),
        ('profiles', 'role')
    ) as required(table_name, column_name)
    where not exists (
      select 1
      from information_schema.columns as existing
      where existing.table_schema = 'public'
        and existing.table_name = required.table_name
        and existing.column_name = required.column_name
    )
  ) then
    raise exception
      'The stock movement or manager profile schema is incompatible with this migration.';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_class as rel
    join pg_catalog.pg_namespace as nsp
      on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname in ('products', 'stock_movements', 'profiles')
      and rel.relrowsecurity
  ) <> 3 then
    raise exception
      'Row-level security must remain enabled on products, stock_movements, and profiles.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as rel
    join pg_catalog.pg_namespace as nsp
      on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname in ('products', 'stock_movements', 'profiles')
      and rel.relforcerowsecurity
  ) then
    raise exception
      'FORCE ROW LEVEL SECURITY is enabled on an inventory table; verify SECURITY DEFINER ownership and policies before applying this migration.';
  end if;
end;
$schema$;

alter table public.products
  add column if not exists category text,
  add column if not exists brand text,
  add column if not exists format text,
  add column if not exists garment_type text,
  add column if not exists size text,
  add column if not exists color text;

update public.products as product
set category = case
  when public.normalize_fixed_product_name(product.name) = 'اتاي' then 'أتاي'
  when public.normalize_fixed_product_name(product.name) = 'الحوايج' then 'الحوايج'
  else null
end
where product.category is null;

alter table public.products
  alter column category set default 'أتاي';

do $catalog$
begin
  if exists (
    select 1
    from public.products as product
    where product.category is null
      or product.category not in ('أتاي', 'الحوايج')
  ) then
    raise exception
      'Every existing product must map to أتاي or الحوايج; no product data was removed.';
  end if;
end;
$catalog$;

alter table public.products
  alter column category set not null;

do $constraints$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_category_valid'
  ) then
    alter table public.products
      add constraint products_category_valid
      check (category in ('أتاي', 'الحوايج'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_category_attributes_required'
  ) then
    alter table public.products
      add constraint products_category_attributes_required
      check (
        (
          category = 'أتاي'
          and brand is not null
          and btrim(brand) <> ''
          and format is not null
          and btrim(format) <> ''
        )
        or (
          category = 'الحوايج'
          and sku is not null
          and btrim(sku) <> ''
          and garment_type is not null
          and btrim(garment_type) <> ''
          and size is not null
          and btrim(size) <> ''
          and color is not null
          and btrim(color) <> ''
        )
      )
      not valid;
  end if;
end;
$constraints$;

drop trigger if exists products_enforce_fixed_catalog on public.products;
drop trigger if exists products_enforce_fixed_catalog_truncate on public.products;
drop index if exists public.products_fixed_catalog_name_unique_idx;
alter table public.products
  drop constraint if exists products_fixed_catalog_name_check;
drop function if exists public.enforce_fixed_product_catalog();

create or replace function public.enforce_product_category_attributes()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception using
      errcode = '23514',
      message = 'Products cannot be deleted from the inventory catalog.';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception using
        errcode = '23514',
        message = 'Product IDs cannot be changed.';
    end if;
    if new.category is distinct from old.category then
      raise exception using
        errcode = '23514',
        message = 'A product category cannot be changed.';
    end if;
  end if;

  if new.category not in ('أتاي', 'الحوايج') then
    raise exception using
      errcode = '23514',
      message = 'Only أتاي and الحوايج product categories are allowed.';
  end if;

  new.name := btrim(new.name);
  new.unit := btrim(new.unit);

  if new.category = 'أتاي' then
    new.brand := nullif(btrim(new.brand), '');
    new.format := nullif(btrim(new.format), '');
    if new.brand is null or new.format is null then
      raise exception using
        errcode = '23514',
        message = 'Tea products require a brand and weight or format.';
    end if;
  else
    new.sku := nullif(btrim(new.sku), '');
    new.garment_type := nullif(btrim(new.garment_type), '');
    new.size := nullif(btrim(new.size), '');
    new.color := nullif(btrim(new.color), '');
    if new.sku is null
      or new.garment_type is null
      or new.size is null
      or new.color is null then
      raise exception using
        errcode = '23514',
        message = 'Clothing products require a reference, type, size, and color.';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_product_category_attributes()
  from public, anon, authenticated, service_role;

drop trigger if exists products_enforce_category_attributes on public.products;
drop trigger if exists products_enforce_category_attributes_truncate on public.products;

create trigger products_enforce_category_attributes
before insert or update or delete on public.products
for each row
execute function public.enforce_product_category_attributes();

create trigger products_enforce_category_attributes_truncate
before truncate on public.products
for each statement
execute function public.enforce_product_category_attributes();

create index if not exists products_category_name_idx
  on public.products (category, name);

create unique index if not exists products_tea_variant_unique_idx
  on public.products (lower(btrim(name)), lower(btrim(brand)), lower(btrim(format)))
  where category = 'أتاي'
    and brand is not null
    and format is not null;

grant insert (
  category,
  brand,
  format,
  garment_type,
  size,
  color
) on public.products to authenticated;

grant update (
  brand,
  format,
  garment_type,
  size,
  color
) on public.products to authenticated;

create or replace view public.product_stock
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
  product.active,
  product.category,
  product.sku,
  product.brand,
  product.format,
  product.garment_type,
  product.size,
  product.color
from public.products as product
left join public.stock_movements as movement
  on movement.product_id = product.id
group by
  product.id,
  product.name,
  product.unit,
  product.low_stock_threshold,
  product.active,
  product.category,
  product.sku,
  product.brand,
  product.format,
  product.garment_type,
  product.size,
  product.color;

create or replace function public.reset_inventory()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_user_role text;
  v_product_id uuid;
  v_product_ids uuid[] := array[]::uuid[];
  v_preserved_products bigint;
  v_deleted_movements bigint;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication is required.';
  end if;

  select profile.role
  into v_user_role
  from public.profiles as profile
  where profile.id = v_user_id
  for share;

  if not found or v_user_role <> 'manager' then
    raise exception using
      errcode = '42501',
      message = 'Only managers can reset inventory.';
  end if;

  lock table public.products in share row exclusive mode;

  for v_product_id in
    select product.id
    from public.products as product
    order by product.id
    for update
  loop
    v_product_ids := pg_catalog.array_append(v_product_ids, v_product_id);
  end loop;

  v_preserved_products := pg_catalog.cardinality(v_product_ids);

  delete from public.stock_movements as movement
  where movement.product_id = any(v_product_ids);
  get diagnostics v_deleted_movements = row_count;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'deleted_movements', v_deleted_movements,
    'preserved_products', v_preserved_products
  );
end;
$function$;

revoke all on function public.reset_inventory()
  from public, anon, authenticated, service_role;

grant execute on function public.reset_inventory()
  to authenticated;

commit;
