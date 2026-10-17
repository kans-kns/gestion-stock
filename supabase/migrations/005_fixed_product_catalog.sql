begin;

do $schema$
begin
  if pg_catalog.to_regclass('public.products') is null
    or pg_catalog.to_regclass('public.stock_movements') is null
    or pg_catalog.to_regclass('public.product_stock') is null then
    raise exception
      'Expected inventory tables and product_stock view are missing; verify the deployed schema before applying this migration.';
  end if;

  if exists (
    select 1
    from (
      values
        ('products', 'id'),
        ('products', 'name'),
        ('products', 'unit'),
        ('products', 'low_stock_threshold'),
        ('products', 'sku'),
        ('products', 'active'),
        ('stock_movements', 'product_id'),
        ('stock_movements', 'reference'),
        ('stock_movements', 'type'),
        ('stock_movements', 'quantity'),
        ('stock_movements', 'party'),
        ('stock_movements', 'note'),
        ('stock_movements', 'created_at'),
        ('stock_movements', 'created_by')
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
      'Inventory schema does not match the expected product and movement columns; verify the deployed schema before applying this migration.';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_class as rel
    join pg_catalog.pg_namespace as nsp
      on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname in ('products', 'stock_movements')
      and rel.relrowsecurity
  ) <> 2 then
    raise exception
      'Row-level security must remain enabled on products and stock_movements.';
  end if;
end;
$schema$;

create or replace function public.normalize_fixed_product_name(p_name text)
returns text
language sql
immutable
strict
set search_path = ''
as $function$
  select pg_catalog.translate(
    pg_catalog.translate(
      pg_catalog.regexp_replace(
        pg_catalog.lower(pg_catalog.btrim(p_name)),
        '[[:space:]]+',
        '',
        'g'
      ),
      'أإآٱ',
      'اااا'
    ),
    'ـًٌٍَُِّْٰ',
    ''
  );
$function$;

revoke all on function public.normalize_fixed_product_name(text)
  from public, anon, authenticated, service_role;
grant execute on function public.normalize_fixed_product_name(text)
  to authenticated, service_role;

do $migration$
begin
  if exists (
    select 1
    from public.products as product
    group by public.normalize_fixed_product_name(product.name)
    having count(*) > 1
  ) then
    raise exception
      'Duplicate product names normalize to the same authorized catalog entry; reconcile them before applying this migration.';
  end if;

  if exists (
    select 1
    from public.products as product
    where public.normalize_fixed_product_name(product.name)
      not in ('اتاي', 'الحوايج')
  ) then
    raise exception
      'Products outside the authorized catalog exist; review them and their stock movements before applying this migration.';
  end if;
end;
$migration$;

create or replace function public.enforce_fixed_product_catalog()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_normalized_name text;
  v_old_normalized_name text;
begin
  if tg_op = 'TRUNCATE' then
    raise exception using
      errcode = '23514',
      message = 'The authorized products cannot be removed.';
  end if;

  if tg_op = 'DELETE' then
    raise exception using
      errcode = '23514',
      message = 'The authorized products cannot be removed.';
  end if;

  v_normalized_name := public.normalize_fixed_product_name(new.name);

  if v_normalized_name = 'اتاي' then
    new.name := 'أتاي';
  elsif v_normalized_name = 'الحوايج' then
    new.name := 'الحوايج';
  else
    raise exception using
      errcode = '23514',
      message = 'Only أتاي and الحوايج are allowed products.';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception using
        errcode = '23514',
        message = 'Authorized product IDs cannot be changed.';
    end if;

    v_old_normalized_name := public.normalize_fixed_product_name(old.name);
    if v_normalized_name is distinct from v_old_normalized_name then
      raise exception using
        errcode = '23514',
        message = 'Authorized product identities cannot be changed.';
    end if;
  end if;

  new.unit := 'كرتون';
  new.low_stock_threshold := 10;
  new.active := true;
  return new;
end;
$function$;

revoke all on function public.enforce_fixed_product_catalog()
  from public, anon, authenticated, service_role;

drop trigger if exists products_enforce_fixed_catalog on public.products;
create trigger products_enforce_fixed_catalog
before insert or update or delete on public.products
for each row
execute function public.enforce_fixed_product_catalog();

drop trigger if exists products_enforce_fixed_catalog_truncate on public.products;
create trigger products_enforce_fixed_catalog_truncate
before truncate on public.products
for each statement
execute function public.enforce_fixed_product_catalog();

update public.products as product
set name = case
  when public.normalize_fixed_product_name(product.name) = 'اتاي' then 'أتاي'
  else 'الحوايج'
end
where product.name is distinct from case
  when public.normalize_fixed_product_name(product.name) = 'اتاي' then 'أتاي'
  else 'الحوايج'
end;

do $constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_fixed_catalog_name_check'
  ) then
    alter table public.products
      add constraint products_fixed_catalog_name_check
      check (name in ('أتاي', 'الحوايج'));
  end if;
end;
$constraint$;

create unique index if not exists products_fixed_catalog_name_unique_idx
  on public.products (name);

insert into public.products (name, unit, low_stock_threshold, sku, active)
values
  ('أتاي', 'كرتون', 10, null, true),
  ('الحوايج', 'كرتون', 10, null, true)
on conflict (name) do update
set
  unit = excluded.unit,
  low_stock_threshold = excluded.low_stock_threshold,
  active = excluded.active
where products.unit is distinct from excluded.unit
  or products.low_stock_threshold is distinct from excluded.low_stock_threshold
  or products.active is distinct from excluded.active;

commit;
