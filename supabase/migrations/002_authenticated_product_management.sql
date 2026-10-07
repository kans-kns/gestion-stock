begin;

drop policy if exists products_insert_manager on public.products;
create policy products_insert_authenticated
on public.products
for insert
to authenticated
with check (true);

drop policy if exists products_update_manager on public.products;
create policy products_update_authenticated
on public.products
for update
to authenticated
using (true)
with check (true);

commit;
