-- Store the hospital's full address entered during registration.
-- Keeping this in the DB allows reliable geocoding and map placement during booking.

ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS address text;
