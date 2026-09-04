INSERT INTO public.cosmetics (slug, name, slot, rarity, description, price_sparks, required_level, featured, pool) VALUES
('tag-owner-sovereign','Sovereign','nametag','mythic','Molten gold script that only one account will ever wear.',0,1,true,'owner'),
('tag-owner-eclipse','Total Eclipse','nametag','mythic','A dark corona with a burning white rim.',0,1,true,'owner'),
('tag-owner-starforge','Starforge','nametag','mythic','Names forged in the heart of a collapsing star.',0,1,true,'owner'),
('tag-owner-monarch','Monarch Ink','nametag','mythic','Royal violet bleeding into liquid chrome.',0,1,true,'owner'),
('badge-owner-crown','Owner''s Crown','badge','mythic','The crown. There is exactly one.',0,1,true,'owner'),
('badge-owner-eye','All-Seeing','badge','mythic','Sees every room, every log, every account.',0,1,true,'owner'),
('badge-owner-nova','Prime Nova','badge','mythic','A detonating star pinned beside your name.',0,1,true,'owner'),
('frame-owner-throne','Throne Halo','frame','mythic','A slow gold halo that never stops turning.',0,1,true,'owner'),
('frame-owner-singularity','Singularity','frame','mythic','Light bends inward around your avatar.',0,1,true,'owner'),
('frame-owner-relic','Living Relic','frame','mythic','Ancient plating that breathes with power.',0,1,true,'owner'),
('banner-owner-dominion','Dominion','banner','mythic','A gilded skyline over an endless dark.',0,1,true,'owner'),
('banner-owner-aurora-prime','Aurora Prime','banner','mythic','Owner-grade aurora, painted in gold and ice.',0,1,true,'owner'),
('banner-owner-throneroom','Throne Room','banner','mythic','Pillars of light in an obsidian hall.',0,1,true,'owner'),
('fx-owner-descend','Sovereign Descent','effect','mythic','Your messages arrive on a shaft of gold light.',0,1,true,'owner')
ON CONFLICT (slug) DO UPDATE SET pool = EXCLUDED.pool, rarity = EXCLUDED.rarity, price_sparks = 0;

-- Nobody can buy exclusive pools
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

  IF item.pool IN ('founder', 'owner') THEN
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

-- Founder + owner pools go to the first account only
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
  SELECT _user_id, c.slug FROM public.cosmetics c WHERE c.pool IN ('founder', 'owner')
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_founder_cosmetics(uuid) FROM PUBLIC, anon;

-- Staff grants may never hand out exclusive pools to other accounts
CREATE OR REPLACE FUNCTION public.staff_grant_cosmetic(_user_id uuid, _slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pool text;
  _first uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT pool INTO _pool FROM public.cosmetics WHERE slug = _slug;
  IF _pool IS NULL THEN RETURN jsonb_build_object('status', 'unknown_item'); END IF;

  SELECT id INTO _first FROM public.profiles ORDER BY created_at ASC, id ASC LIMIT 1;
  IF _pool IN ('founder', 'owner') AND _user_id <> _first THEN
    RETURN jsonb_build_object('status', 'exclusive');
  END IF;

  INSERT INTO public.inventory (user_id, cosmetic_slug)
  VALUES (_user_id, _slug)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_cosmetic', jsonb_build_object('slug', _slug));

  RETURN jsonb_build_object('status', 'granted', 'slug', _slug);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_grant_cosmetic(uuid, text) FROM PUBLIC, anon;

-- Strip exclusive items from anyone who is not the first account
DELETE FROM public.inventory inv
USING public.cosmetics c
WHERE inv.cosmetic_slug = c.slug
  AND c.pool IN ('founder', 'owner')
  AND inv.user_id <> (SELECT id FROM public.profiles ORDER BY created_at ASC, id ASC LIMIT 1);

SELECT public.grant_founder_cosmetics((SELECT id FROM public.profiles ORDER BY created_at ASC, id ASC LIMIT 1));