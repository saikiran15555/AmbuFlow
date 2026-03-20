alter table public.drivers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_driver_id_fkey'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_driver_id_fkey
      foreign key (driver_id)
      references public.drivers(id)
      on delete set null;
  end if;
end
$$;

drop policy if exists "Hospitals can read assigned drivers" on public.drivers;

create policy "Hospitals can read assigned drivers"
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
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('hospital', 'admin')
  )
);
