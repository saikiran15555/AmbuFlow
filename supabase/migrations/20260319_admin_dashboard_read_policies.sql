alter table public.profiles enable row level security;
alter table public.hospitals enable row level security;
alter table public.drivers enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Allow admin dashboard read profiles" on public.profiles;
drop policy if exists "Allow admin dashboard read hospitals" on public.hospitals;
drop policy if exists "Allow admin dashboard read drivers" on public.drivers;
drop policy if exists "Allow admin dashboard read bookings" on public.bookings;

create policy "Allow admin dashboard read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Allow admin dashboard read hospitals"
on public.hospitals
for select
to authenticated
using (true);

create policy "Allow admin dashboard read drivers"
on public.drivers
for select
to authenticated
using (true);

create policy "Allow admin dashboard read bookings"
on public.bookings
for select
to authenticated
using (true);
