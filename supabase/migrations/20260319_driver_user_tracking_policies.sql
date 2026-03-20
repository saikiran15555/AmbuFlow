alter table public.bookings enable row level security;
alter table public.drivers enable row level security;

drop policy if exists "Users can read own bookings" on public.bookings;
drop policy if exists "Drivers can read assigned bookings" on public.bookings;
drop policy if exists "Drivers can update own location" on public.drivers;
drop policy if exists "Authenticated users can read driver tracking" on public.drivers;

create policy "Users can read own bookings"
on public.bookings
for select
to authenticated
using (user_id = auth.uid());

create policy "Drivers can read assigned bookings"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.drivers d
    where d.id = bookings.driver_id
      and d.profile_id = auth.uid()
  )
);

create policy "Drivers can update own location"
on public.drivers
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Authenticated users can read driver tracking"
on public.drivers
for select
to authenticated
using (true);
