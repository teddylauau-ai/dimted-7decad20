-- 1) Founder cosmetics: a locked pool, never purchasable.
INSERT INTO public.cosmetics (slug, name, slot, rarity, description, price_sparks, required_level, featured, pool, available_until) VALUES
  ('tag-founder-halo',      'Founder''s Halo',   'nametag', 'mythic', 'Molten gold light that never stops moving. Only the first 25 accounts wear it.', 0, 1, true,  'founder', NULL),
  ('tag-founder-genesis',   'Genesis Ink',       'nametag', 'mythic', 'Liquid prism script signed into the platform at launch.',                        0, 1, true,  'founder', NULL),
  ('tag-founder-obsidian',  'Obsidian Charter',  'nametag', 'mythic', 'Black glass lettering with a razor of white fire through it.',                  0, 1, false, 'founder', NULL),
  ('badge-founder-crest',   'Founder Crest',     'badge',   'mythic', 'The original crest. It cannot be earned again.',                                0, 1, true,  'founder', NULL),
  ('badge-founder-key',     'Genesis Key',       'badge',   'mythic', 'The key to the vault that minted Dimted.',                                      0, 1, false, 'founder', NULL),
  ('frame-founder-aureate', 'Aureate Ring',      'frame',   'mythic', 'A slow-breathing halo of hammered gold around your avatar.',                    0, 1, true,  'founder', NULL),
  ('frame-founder-orbital', 'Orbital Genesis',   'frame',   'mythic', 'Twin gold and aurora arcs orbiting your avatar forever.',                       0, 1, true,  'founder', NULL),
  ('banner-founder-firstlight','First Light',    'banner',  'mythic', 'The sunrise the first 25 accounts logged in to.',                               0, 1, true,  'founder', NULL),
  ('banner-founder-vault',  'Genesis Vault',     'banner',  'mythic', 'Gilded vault plating etched with the founding grid.',                           0, 1, false, 'founder', NULL),
  ('fx-founder-arrival',    'Gilded Arrival',    'effect',  'mythic', 'Your messages land on a sweep of gold light.',                                  0, 1, true,  'founder', NULL)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, slot = EXCLUDED.slot, rarity = EXCLUDED.rarity,
  description = EXCLUDED.description, price_sparks = 0, required_level = 1,
  featured = EXCLUDED.featured, pool = 'founder', available_until = NULL;

-- 2) Founder items can never be purchased, no matter how many Sparks you have.
CREATE OR REPLACE FUNCTION public.purchase_cosmetic(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item public.cosmetics;
  prof public.profiles;
  lvl integer;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;

  SELECT * INTO item FROM public.cosmetics WHERE slug = _slug;
  IF item.slug IS NULL THEN RETURN jsonb_build_object('status', 'unknown_item'); END IF;

  IF item.pool = 'founder' THEN
    RETURN jsonb_build_object('status', 'exclusive');
  END IF;

  IF item.available_until IS NOT NULL AND item.available_until < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory WHERE user_id = prof.id AND cosmetic_slug = _slug) THEN
    RETURN jsonb_build_object('status', 'owned');
  END IF;

  lvl := public.level_from_xp(prof.total_xp);
  IF lvl < item.required_level THEN
    RETURN jsonb_build_object('status', 'locked', 'required_level', item.required_level, 'level', lvl);
  END IF;

  IF prof.sparks < item.price_sparks THEN
    RETURN jsonb_build_object('status', 'insufficient', 'sparks', prof.sparks, 'price', item.price_sparks);
  END IF;

  UPDATE public.profiles SET sparks = sparks - item.price_sparks WHERE id = prof.id RETURNING * INTO prof;
  INSERT INTO public.inventory (user_id, cosmetic_slug) VALUES (prof.id, _slug);

  RETURN jsonb_build_object('status', 'purchased', 'sparks', prof.sparks, 'slug', _slug);
END;
$function$;

-- 3) Founder window: the first 25 accounts ever created.
CREATE OR REPLACE FUNCTION public.grant_founder_cosmetics(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rank_no integer;
BEGIN
  SELECT count(*) INTO rank_no
  FROM public.profiles p
  WHERE p.created_at <= (SELECT created_at FROM public.profiles WHERE id = _user_id);

  IF rank_no IS NULL OR rank_no > 25 THEN RETURN; END IF;

  INSERT INTO public.inventory (user_id, cosmetic_slug)
  SELECT _user_id, c.slug FROM public.cosmetics c WHERE c.pool = 'founder'
  ON CONFLICT (user_id, cosmetic_slug) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_founder_cosmetics(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.on_profile_founder_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.grant_founder_cosmetics(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_profile_founder_grant ON public.profiles;
CREATE TRIGGER on_profile_founder_grant
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.on_profile_founder_grant();

-- 4) Backfill: every existing account inside the founder window gets the set now.
INSERT INTO public.inventory (user_id, cosmetic_slug)
SELECT f.id, c.slug
FROM (SELECT id FROM public.profiles ORDER BY created_at LIMIT 25) f
CROSS JOIN public.cosmetics c
WHERE c.pool = 'founder'
ON CONFLICT (user_id, cosmetic_slug) DO NOTHING;