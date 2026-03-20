alter table public.drivers enable row level security;
alter table public.hospitals enable row level security;
alter table public.bookings enable row level security;

update public.profiles p
set
  full_name = coalesce(nullif(p.full_name, ''), nullif(d.full_name, ''), p.full_name),
  phone = coalesce(nullif(p.phone, ''), nullif(d.phone, ''), p.phone)
from public.drivers d
where d.profile_id = p.id
  and (
    (coalesce(p.full_name, '') = '' and coalesce(d.full_name, '') <> '')
    or (coalesce(p.phone, '') = '' and coalesce(d.phone, '') <> '')
  );

delete from public.drivers d
where d.profile_id is null
   or d.hospital_id is null
   or not exists (
     select 1
     from public.profiles p
     where p.id = d.profile_id
   )
   or not exists (
     select 1
     from public.hospitals h
     where h.id = d.hospital_id
   );

update public.drivers
set approval_status = coalesce(approval_status, 'pending')
where approval_status is null;

update public.drivers
set is_available = coalesce(is_available, false)
where is_available is null;

alter table public.drivers
  alter column profile_id set not null,
  alter column hospital_id set not null,
  alter column license_number set not null,
  alter column approval_status set not null,
  alter column is_available set not null;

alter table public.drivers
  alter column approval_status set default 'pending',
  alter column is_available set default false;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'drivers_approval_status_check'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      drop constraint drivers_approval_status_check;
  end if;
end
$$;

alter table public.drivers
  add constraint drivers_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'drivers_profile_id_key'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      drop constraint drivers_profile_id_key;
  end if;
end
$$;

alter table public.drivers
  add constraint drivers_profile_id_key unique (profile_id);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'drivers_license_number_key'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      drop constraint drivers_license_number_key;
  end if;
end
$$;

alter table public.drivers
  add constraint drivers_license_number_key unique (license_number);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'drivers_profile_id_fkey'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      drop constraint drivers_profile_id_fkey;
  end if;
end
$$;

alter table public.drivers
  add constraint drivers_profile_id_fkey
  foreign key (profile_id)
  references public.profiles(id)
  on delete cascade;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'drivers_hospital_id_fkey'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      drop constraint drivers_hospital_id_fkey;
  end if;
end
$$;

alter table public.drivers
  add constraint drivers_hospital_id_fkey
  foreign key (hospital_id)
  references public.hospitals(id)
  on delete cascade;

drop trigger if exists sync_driver_compatibility_columns on public.drivers;
drop function if exists public.sync_driver_compatibility_columns();

drop index if exists public.drivers_hospital_id_idx;
drop index if exists public.drivers_approval_status_idx;
drop index if exists public.drivers_is_available_idx;
drop index if exists public.drivers_status_idx;
drop index if exists public.drivers_availability_idx;
drop index if exists public.idx_drivers_hospital_id;
drop index if exists public.idx_drivers_approval_status;
drop index if exists public.idx_drivers_is_available;
drop index if exists public.idx_drivers_status;
drop index if exists public.idx_drivers_availability;

create index if not exists drivers_hospital_id_idx on public.drivers (hospital_id);
create index if not exists drivers_approval_status_idx on public.drivers (approval_status);
create index if not exists drivers_is_available_idx on public.drivers (is_available);

alter table public.drivers
  drop column if exists full_name,
  drop column if exists phone,
  drop column if exists email,
  drop column if exists status,
  drop column if exists availability;

drop policy if exists "hospital can view drivers" on public.drivers;
drop policy if exists "hospital can manage drivers" on public.drivers;

create policy "hospital can view drivers"
on public.drivers
for select
to authenticated
using (
  exists (
    select 1
    from public.hospitals h
    where h.id = drivers.hospital_id
      and h.profile_id = auth.uid()
  )
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create policy "hospital can manage drivers"
on public.drivers
for all
to authenticated
using (
  exists (
    select 1
    from public.hospitals h
    where h.id = drivers.hospital_id
      and h.profile_id = auth.uid()
  )
  or profile_id = auth.uid()
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
    where h.id = drivers.hospital_id
      and h.profile_id = auth.uid()
  )
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
