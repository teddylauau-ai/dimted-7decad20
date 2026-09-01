-- 1. Role hierarchy -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.role_rank(_role app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN 40
    WHEN 'admin' THEN 30
    WHEN 'moderator' THEN 20
    ELSE 10
  END
$$;

CREATE OR REPLACE FUNCTION public.top_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY public.role_rank(role) DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.my_rank()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(max(public.role_rank(role)), 10)
  FROM public.user_roles WHERE user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.role_rank(app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.top_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_rank() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_rank(app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_rank() TO authenticated;

-- Tighten role management to respect the hierarchy: you may only act on a role
-- strictly below your own rank, and only the owner may create admins.
DROP POLICY IF EXISTS user_roles_insert_staff ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete_staff ON public.user_roles;

CREATE POLICY user_roles_insert_hierarchy ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  role <> 'owner'
  AND public.role_rank(role) < public.my_rank()
  AND public.role_rank(coalesce(public.top_role(user_id), 'member')) < public.my_rank()
);

CREATE POLICY user_roles_delete_hierarchy ON public.user_roles
FOR DELETE TO authenticated
USING (
  role <> 'owner'
  AND public.role_rank(role) < public.my_rank()
);

-- 2. Titles -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.titles (
  slug text PRIMARY KEY,
  label text NOT NULL,
  tier integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.titles TO authenticated;
GRANT SELECT ON public.titles TO anon;
GRANT ALL ON public.titles TO service_role;
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS titles_select_everyone ON public.titles;
CREATE POLICY titles_select_everyone ON public.titles
FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.titles (slug, label, tier) VALUES
  ('newcomer', 'Newcomer', 1),
  ('regular', 'Regular', 2),
  ('signal-carrier', 'Signal Carrier', 3),
  ('arcade-runner', 'Arcade Runner', 3),
  ('night-owl', 'Night Owl', 4),
  ('luminary', 'Luminary', 5),
  ('aurora-adept', 'Aurora Adept', 6),
  ('void-walker', 'Void Walker', 7),
  ('starforged', 'Starforged', 8),
  ('mythic', 'Mythic', 9),
  ('founder', 'Founder', 10)
ON CONFLICT (slug) DO NOTHING;

-- 3. Staff action log ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.staff_actions TO authenticated;
GRANT ALL ON public.staff_actions TO service_role;
ALTER TABLE public.staff_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_actions_select_staff ON public.staff_actions;
CREATE POLICY staff_actions_select_staff ON public.staff_actions
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS staff_actions_created_idx ON public.staff_actions (created_at DESC);

-- 4. Owner / admin grant tools ------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_grant_currency(_user_id uuid, _xp integer DEFAULT 0, _sparks integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rank integer := public.my_rank();
  cap integer;
  xp integer;
  sparks integer;
  prof public.profiles;
BEGIN
  IF rank < 30 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  cap := CASE WHEN rank >= 40 THEN 10000000 ELSE 25000 END;

  xp := greatest(-cap, least(coalesce(_xp, 0), cap));
  sparks := greatest(-cap, least(coalesce(_sparks, 0), cap));

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  UPDATE public.profiles
  SET total_xp = greatest(0, total_xp + xp),
      sparks = greatest(0, sparks + sparks)
  WHERE id = _user_id
  RETURNING * INTO prof;

  IF xp <> 0 THEN
    INSERT INTO public.xp_events (user_id, source, amount, label)
    VALUES (_user_id, 'staff', xp, 'staff grant');
  END IF;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_currency', jsonb_build_object('xp', xp, 'sparks', sparks));

  RETURN jsonb_build_object('status', 'granted', 'total_xp', prof.total_xp, 'sparks', prof.sparks);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_grant_cosmetic(_user_id uuid, _slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  granted integer := 0;
BEGIN
  IF public.my_rank() < 30 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;

  IF _slug = '*' THEN
    IF public.my_rank() < 40 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
    INSERT INTO public.inventory (user_id, cosmetic_slug)
    SELECT _user_id, c.slug FROM public.cosmetics c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory i WHERE i.user_id = _user_id AND i.cosmetic_slug = c.slug
    );
    granted := 1;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.cosmetics WHERE slug = _slug) THEN
      RETURN jsonb_build_object('status', 'unknown_item');
    END IF;
    INSERT INTO public.inventory (user_id, cosmetic_slug)
    VALUES (_user_id, _slug)
    ON CONFLICT DO NOTHING;
    granted := 1;
  END IF;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_cosmetic', jsonb_build_object('slug', _slug));

  RETURN jsonb_build_object('status', 'granted', 'slug', _slug, 'count', granted);
END;
$$;

-- Titles are owner-only, by design.
CREATE OR REPLACE FUNCTION public.owner_set_title(_user_id uuid, _title text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  final_label text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF _title IS NULL OR length(btrim(_title)) = 0 THEN
    final_label := 'Newcomer';
  ELSE
    SELECT label INTO final_label FROM public.titles WHERE slug = _title;
    IF final_label IS NULL THEN
      final_label := left(btrim(_title), 40);
    END IF;
  END IF;

  UPDATE public.profiles SET title = final_label WHERE id = _user_id;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'set_title', jsonb_build_object('title', final_label));

  RETURN jsonb_build_object('status', 'set', 'title', final_label);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_ignite_surge_for(_user_id uuid, _minutes integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.my_rank() < 30 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;

  UPDATE public.profiles
  SET energy = 100,
      surge_until = now() + (greatest(1, least(coalesce(_minutes, 30), 720)) || ' minutes')::interval
  WHERE id = _user_id;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'surge', jsonb_build_object('minutes', _minutes));

  RETURN jsonb_build_object('status', 'granted');
END;
$$;

REVOKE ALL ON FUNCTION public.staff_grant_currency(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_grant_cosmetic(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_set_title(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_ignite_surge_for(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_grant_currency(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_grant_cosmetic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_set_title(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_ignite_surge_for(uuid, integer) TO authenticated;
