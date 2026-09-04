-- 1) Convert founder pool into an admin pool with staff-themed naming
UPDATE public.cosmetics SET pool = 'admin' WHERE pool = 'founder';

UPDATE public.cosmetics SET name = 'Sentinel Ink', description = 'Admin-issue nametag etched in sentinel violet.' WHERE slug = 'tag-founder-genesis';
UPDATE public.cosmetics SET name = 'Warden Halo', description = 'A cool halo worn only by Dimted staff.' WHERE slug = 'tag-founder-halo';
UPDATE public.cosmetics SET name = 'Obsidian Command', description = 'Obsidian plate reserved for the admin bench.' WHERE slug = 'tag-founder-obsidian';
UPDATE public.cosmetics SET name = 'Sentinel Crest', description = 'Crest marking a trusted Dimted admin.' WHERE slug = 'badge-founder-crest';
UPDATE public.cosmetics SET name = 'Override Key', description = 'The key symbol of admin override authority.' WHERE slug = 'badge-founder-key';
UPDATE public.cosmetics SET name = 'Sentinel Ring', description = 'Cool-toned ring frame for staff avatars.' WHERE slug = 'frame-founder-aureate';
UPDATE public.cosmetics SET name = 'Orbital Command', description = 'Orbiting command frame for staff avatars.' WHERE slug = 'frame-founder-orbital';
UPDATE public.cosmetics SET name = 'Command Dawn', description = 'Admin banner lit in teal command light.' WHERE slug = 'banner-founder-firstlight';
UPDATE public.cosmetics SET name = 'Warden Vault', description = 'Admin banner sealed behind the warden vault.' WHERE slug = 'banner-founder-vault';
UPDATE public.cosmetics SET name = 'Sentinel Arrival', description = 'Your messages arrive on a sentinel pulse.' WHERE slug = 'fx-founder-arrival';

-- 2) Owner grant function now only covers owner-pool items
CREATE OR REPLACE FUNCTION public.grant_founder_cosmetics(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _first uuid;
BEGIN
  SELECT id INTO _first FROM public.profiles ORDER BY created_at ASC, id ASC LIMIT 1;
  IF _first IS NULL OR _first <> _user_id THEN
    RETURN;
  END IF;

  INSERT INTO public.inventory (user_id, cosmetic_slug)
  SELECT _user_id, c.slug FROM public.cosmetics c WHERE c.pool = 'owner'
  ON CONFLICT DO NOTHING;
END;
$function$;

-- 3) Admin pool auto-grant for staff
CREATE OR REPLACE FUNCTION public.grant_admin_cosmetics(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'owner')) THEN
    RETURN;
  END IF;

  INSERT INTO public.inventory (user_id, cosmetic_slug)
  SELECT _user_id, c.slug FROM public.cosmetics c WHERE c.pool = 'admin'
  ON CONFLICT DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_role_admin_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IN ('admin', 'owner') THEN
    PERFORM public.grant_admin_cosmetics(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_role_admin_grant ON public.user_roles;
CREATE TRIGGER trg_role_admin_grant
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.on_role_admin_grant();

-- 4) Never purchasable
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

  IF item.pool IN ('admin', 'owner', 'founder') THEN
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

-- 5) Staff grants: owner-only for exclusive pools, admin pool only to staff
CREATE OR REPLACE FUNCTION public.staff_grant_cosmetic(_user_id uuid, _slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item public.cosmetics;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  SELECT * INTO item FROM public.cosmetics WHERE slug = _slug;
  IF item.slug IS NULL THEN RETURN jsonb_build_object('status', 'unknown_item'); END IF;

  IF item.pool = 'owner' THEN
    RETURN jsonb_build_object('status', 'owner_only');
  END IF;

  IF item.pool IN ('admin', 'founder') THEN
    IF NOT public.has_role(auth.uid(), 'owner') THEN
      RETURN jsonb_build_object('status', 'owner_only');
    END IF;
    IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'owner')) THEN
      RETURN jsonb_build_object('status', 'staff_only');
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  INSERT INTO public.inventory (user_id, cosmetic_slug)
  VALUES (_user_id, _slug)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_cosmetic', jsonb_build_object('slug', _slug, 'pool', item.pool));

  RETURN jsonb_build_object('status', 'granted', 'slug', _slug);
END;
$function$;

-- 6) Reconcile existing data: staff get the vault, everyone else loses it
INSERT INTO public.inventory (user_id, cosmetic_slug)
SELECT ur.user_id, c.slug
FROM public.user_roles ur
CROSS JOIN public.cosmetics c
WHERE ur.role IN ('admin', 'owner') AND c.pool = 'admin'
ON CONFLICT DO NOTHING;

DELETE FROM public.inventory i
USING public.cosmetics c
WHERE i.cosmetic_slug = c.slug
  AND c.pool = 'admin'
  AND NOT (public.has_role(i.user_id, 'admin') OR public.has_role(i.user_id, 'owner'));

UPDATE public.profiles p SET equipped_nametag = NULL
WHERE equipped_nametag IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.inventory i WHERE i.user_id = p.id AND i.cosmetic_slug = p.equipped_nametag);
UPDATE public.profiles p SET equipped_badge = NULL
WHERE equipped_badge IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.inventory i WHERE i.user_id = p.id AND i.cosmetic_slug = p.equipped_badge);
UPDATE public.profiles p SET equipped_frame = NULL
WHERE equipped_frame IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.inventory i WHERE i.user_id = p.id AND i.cosmetic_slug = p.equipped_frame);
UPDATE public.profiles p SET equipped_banner = NULL
WHERE equipped_banner IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.inventory i WHERE i.user_id = p.id AND i.cosmetic_slug = p.equipped_banner);
UPDATE public.profiles p SET equipped_effect = NULL
WHERE equipped_effect IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.inventory i WHERE i.user_id = p.id AND i.cosmetic_slug = p.equipped_effect);