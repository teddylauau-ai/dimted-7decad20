-- Only the first account (owner) gets founder cosmetics
CREATE OR REPLACE FUNCTION public.grant_founder_cosmetics(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _first uuid;
BEGIN
  SELECT id INTO _first FROM public.profiles ORDER BY created_at ASC, id ASC LIMIT 1;
  IF _first IS NULL OR _first <> _user_id THEN
    RETURN;
  END IF;

  INSERT INTO public.inventory (user_id, cosmetic_slug)
  SELECT _user_id, c.slug FROM public.cosmetics c WHERE c.pool = 'founder'
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_founder_cosmetics(uuid) FROM PUBLIC, anon;

-- Strip founder items from every non-first account
WITH first_profile AS (
  SELECT id FROM public.profiles ORDER BY created_at ASC, id ASC LIMIT 1
)
DELETE FROM public.inventory inv
USING public.cosmetics c
WHERE inv.cosmetic_slug = c.slug
  AND c.pool = 'founder'
  AND inv.user_id <> (SELECT id FROM first_profile);

UPDATE public.profiles p SET
  equipped_nametag = CASE WHEN p.equipped_nametag IN (SELECT slug FROM public.cosmetics WHERE pool='founder') THEN NULL ELSE p.equipped_nametag END,
  equipped_badge   = CASE WHEN p.equipped_badge   IN (SELECT slug FROM public.cosmetics WHERE pool='founder') THEN NULL ELSE p.equipped_badge END,
  equipped_frame   = CASE WHEN p.equipped_frame   IN (SELECT slug FROM public.cosmetics WHERE pool='founder') THEN NULL ELSE p.equipped_frame END,
  equipped_banner  = CASE WHEN p.equipped_banner  IN (SELECT slug FROM public.cosmetics WHERE pool='founder') THEN NULL ELSE p.equipped_banner END,
  equipped_effect  = CASE WHEN p.equipped_effect  IN (SELECT slug FROM public.cosmetics WHERE pool='founder') THEN NULL ELSE p.equipped_effect END
WHERE p.id <> (SELECT id FROM public.profiles ORDER BY created_at ASC, id ASC LIMIT 1);

-- Make sure the owner has them
SELECT public.grant_founder_cosmetics((SELECT id FROM public.profiles ORDER BY created_at ASC, id ASC LIMIT 1));