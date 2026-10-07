create or replace function public.reset_inventory()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_deleted_movements bigint;
  v_deleted_products bigint;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication is required.';
  end if;

  delete from public.stock_movements
  where true;
  get diagnostics v_deleted_movements = row_count;

  delete from public.products
  where true;
  get diagnostics v_deleted_products = row_count;

  return jsonb_build_object(
    'success', true,
    'deleted_movements', v_deleted_movements,
    'deleted_products', v_deleted_products
  );
end;
$function$;

revoke all on function public.reset_inventory()
  from public, anon;

grant execute on function public.reset_inventory()
  to authenticated;
