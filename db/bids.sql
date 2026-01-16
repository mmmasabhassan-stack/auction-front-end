-- Bids table (all bids placed by users)
CREATE TABLE IF NOT EXISTS public.bids (
  bid_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auction_id TEXT NOT NULL REFERENCES public.auctions(auction_id) ON DELETE CASCADE,
  lot_id TEXT NOT NULL REFERENCES public.lots(lot_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bids_auction_lot_amount_idx
  ON public.bids (auction_id, lot_id, amount DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS bids_user_created_idx
  ON public.bids (user_id, created_at DESC);

