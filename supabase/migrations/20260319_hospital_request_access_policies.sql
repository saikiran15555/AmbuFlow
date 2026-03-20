alter table public.hospitals enable row level security;
alter table public.ambulances enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Hospitals can read own hospital row" on public.hospitals;
drop policy if exists "Hospitals can read own ambulances" on public.ambulances;
drop policy if exists "Hospitals can manage own ambulances" on public.ambulances;
drop policy if exists "Hospitals can read own bookings" on public.bookings;
drop policy if exists "Hospitals can insert own bookings" on public.bookings;

create policy "Hospitals can read own hospital row"
on public.hospitals
for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "Hospitals can read own ambulances"
on public.ambulances
for select
to authenticated
using (
  exists (
    select 1
    from public.hospitals h
    where h.id = ambulances.hospital_id
      and h.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "Hospitals can manage own ambulances"
on public.ambulances
for all
to authenticated
using (
  exists (
    select 1
    from public.hospitals h
    where h.id = ambulances.hospital_id
      and h.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.hospitals h
    where h.id = ambulances.hospital_id
      and h.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "Hospitals can read own bookings"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.hospitals h
    where h.id = bookings.hospital_id
      and h.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "Hospitals can insert own bookings"
on public.bookings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.hospitals h
    where h.id = bookings.hospital_id
      and h.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
