-- Adds a simple "wallet" for drivers and simulates payment on trip completion.

alter table public.drivers
  add column if not exists wallet_balance numeric not null default 0;

alter table public.bookings
  add column if not exists payment_method text not null default 'cash',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists paid_at timestamptz null;

-- Light validation.
alter table public.bookings
  drop constraint if exists bookings_payment_method_check;
alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method in ('cash', 'in_app'));

alter table public.bookings
  drop constraint if exists bookings_payment_status_check;
alter table public.bookings
  add constraint bookings_payment_status_check
  check (payment_status in ('pending', 'paid'));

-- When a booking transitions to completed, mark it paid and credit the driver.
create or replace function public.handle_booking_completion_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    if new.status = 'completed' and (old.status is distinct from new.status) then
      new.payment_status := 'paid';
      new.paid_at := now();

      if new.driver_id is not null then
        update public.drivers
          set wallet_balance = coalesce(wallet_balance, 0) + coalesce(new.fare, 0)
          where id = new.driver_id;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bookings_complete_payment on public.bookings;
create trigger trg_bookings_complete_payment
before update of status
on public.bookings
for each row
execute function public.handle_booking_completion_payment();
