alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'drivers_profile_id_fkey'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      add constraint drivers_profile_id_fkey
      foreign key (profile_id)
      references public.profiles(id)
      on delete cascade;
  end if;
end
$$;

drop policy if exists "Hospitals can read driver profiles" on public.profiles;

create policy "Hospitals can read driver profiles"
on public.profiles
for select
to authenticated
using (
  role in ('hospital', 'admin')
  or id = auth.uid()
  or exists (
    select 1
    from public.drivers d
    join public.hospitals h on h.id = d.hospital_id
    where d.profile_id = profiles.id
      and h.profile_id = auth.uid()
  )
);
