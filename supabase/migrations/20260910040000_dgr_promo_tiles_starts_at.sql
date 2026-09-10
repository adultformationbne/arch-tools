-- Promo tiles: optional start date, paired with the existing expires_at.
-- A tile appears on a DGR post dated D when starts_at <= D <= expires_at (nulls are open-ended).
-- Applied to production via the Supabase MCP on 2026-09-10 as migration "dgr_promo_tiles_add_starts_at".
ALTER TABLE public.dgr_promo_tiles ADD COLUMN IF NOT EXISTS starts_at date;
COMMENT ON COLUMN public.dgr_promo_tiles.starts_at IS 'First DGR post date the tile appears on (null = immediately). Paired with expires_at (last date, inclusive).';
