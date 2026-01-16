-- Live state controlled by Admin dashboard (recommended for real live auctions)
CREATE TABLE IF NOT EXISTS public.auction_state (
  auction_id TEXT PRIMARY KEY REFERENCES public.auctions(auction_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled', -- live | paused | ended | scheduled
  active_lot_id TEXT REFERENCES public.lots(lot_id) ON DELETE SET NULL,
  bid_ends_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at_auction_state()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auction_state_updated_at ON public.auction_state;
CREATE TRIGGER trg_auction_state_updated_at
BEFORE UPDATE ON public.auction_state
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_auction_state();

