-- Users table for Admin "User Management"
-- Run this in your database (eauctiondb):
--   psql "$DATABASE_URL" -f db/users.sql

CREATE TABLE IF NOT EXISTS public.users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cnic TEXT NOT NULL,
  paa TEXT DEFAULT ''::text,
  status TEXT NOT NULL DEFAULT 'Enabled',
  role TEXT NOT NULL DEFAULT 'Bidder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: prevent duplicate CNICs
-- CREATE UNIQUE INDEX IF NOT EXISTS users_cnic_uniq ON public.users (cnic);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

