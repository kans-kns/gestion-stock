begin;

do $schema$
begin
  if pg_catalog.to_regclass('public.products') is null
    or pg_catalog.to_regclass('public.stock_movements') is null
    or pg_catalog.to_regclass('public.profiles') is null then
    raise exception
      'Expected products, stock_movements, and profiles tables are missing; verify the deployed schema before applying this migration.';
  end if;

  if exists (
    select 1
    from (
      values
        ('products', 'id'),
        ('products', 'name'),
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
      'Inventory schema does not match the expected reset function columns; verify the deployed schema before applying this migration.';
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

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.products'::regclass
      and constraint_row.conname = 'products_fixed_catalog_name_check'
      and constraint_row.contype = 'c'
      and constraint_row.convalidated
  ) then
    raise exception
      'The validated fixed product catalog constraint from migration 005 is required.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index as index_row
    where index_row.indrelid = 'public.products'::regclass
      and index_row.indexrelid =
        pg_catalog.to_regclass('public.products_fixed_catalog_name_unique_idx')
      and index_row.indisunique
      and index_row.indisvalid
  ) then
    raise exception
      'The valid unique fixed product catalog index from migration 005 is required.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.products'::regclass
      and trigger_row.tgname = 'products_enforce_fixed_catalog'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled in ('O', 'A')
      and trigger_row.tgfoid =
        'public.enforce_fixed_product_catalog()'::regprocedure
  ) or not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.products'::regclass
      and trigger_row.tgname = 'products_enforce_fixed_catalog_truncate'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled in ('O', 'A')
      and trigger_row.tgfoid =
        'public.enforce_fixed_product_catalog()'::regprocedure
  ) then
    raise exception
      'Enabled fixed product catalog triggers from migration 005 are required.';
  end if;
end;
$schema$;

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
  v_distinct_product_count bigint;
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
    where product.name in ('أتاي', 'الحوايج')
    order by product.id
    for update
  loop
    v_product_ids := pg_catalog.array_append(v_product_ids, v_product_id);
  end loop;

  select count(distinct product.name)
  into v_distinct_product_count
  from public.products as product
  where product.id = any(v_product_ids);

  if pg_catalog.cardinality(v_product_ids) <> 2
    or v_distinct_product_count <> 2 then
    raise exception using
      errcode = 'P0001',
      message = 'Both authorized products must exist before inventory can be reset.';
  end if;

  delete from public.stock_movements as movement
  where movement.product_id = any(v_product_ids);
  get diagnostics v_deleted_movements = row_count;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'deleted_movements', v_deleted_movements,
    'preserved_products', pg_catalog.cardinality(v_product_ids)
  );
end;
$function$;

revoke all on function public.reset_inventory()
  from public, anon, authenticated;

grant execute on function public.reset_inventory()
  to authenticated;

commit;
