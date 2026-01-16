-- Winners per lot (final result)
CREATE TABLE IF NOT EXISTS public.lot_winners (
  auction_id TEXT NOT NULL REFERENCES public.auctions(auction_id) ON DELETE CASCADE,
  lot_id TEXT NOT NULL REFERENCES public.lots(lot_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  winning_amount INTEGER NOT NULL CHECK (winning_amount > 0),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (auction_id, lot_id)
);

CREATE INDEX IF NOT EXISTS lot_winners_user_idx
  ON public.lot_winners (user_id, decided_at DESC);

