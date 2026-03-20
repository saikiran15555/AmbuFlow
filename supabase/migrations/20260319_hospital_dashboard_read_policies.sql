alter table public.profiles enable row level security;
alter table public.drivers enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Allow read profiles" on public.profiles;
drop policy if exists "Allow read drivers" on public.drivers;
drop policy if exists "Allow read bookings" on public.bookings;

create policy "Allow read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Allow read drivers"
on public.drivers
for select
to authenticated
using (true);

create policy "Allow read bookings"
on public.bookings
for select
to authenticated
using (true);
