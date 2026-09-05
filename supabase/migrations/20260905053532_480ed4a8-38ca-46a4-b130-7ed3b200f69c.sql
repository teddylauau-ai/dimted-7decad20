ALTER TABLE public.crews
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS accent text NOT NULL DEFAULT 'teal',
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'invite',
  ADD COLUMN IF NOT EXISTS member_limit integer NOT NULL DEFAULT 25;

ALTER TABLE public.crews DROP CONSTRAINT IF EXISTS crews_join_policy_check;
ALTER TABLE public.crews ADD CONSTRAINT crews_join_policy_check CHECK (join_policy IN ('open','invite'));
ALTER TABLE public.crews DROP CONSTRAINT IF EXISTS crews_accent_check;
ALTER TABLE public.crews ADD CONSTRAINT crews_accent_check CHECK (accent IN ('teal','violet','amber','rose','emerald','sky','slate'));

DROP POLICY IF EXISTS "Members can leave their crew" ON public.crew_members;
CREATE POLICY "Members can leave their crew"
ON public.crew_members FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_crew(
  _name text,
  _tagline text,
  _badge_emoji text,
  _visibility text,
  _accent text,
  _join_policy text,
  _description text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _slug text;
  _id uuid;
  _owned integer;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not signed in'); END IF;
  IF public.is_banned(_uid) THEN RETURN jsonb_build_object('ok', false, 'error', 'account restricted'); END IF;
  IF coalesce(trim(_name), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'name required'); END IF;

  SELECT count(*) INTO _owned FROM public.crews WHERE owner_id = _uid;
  IF _owned >= 5 THEN RETURN jsonb_build_object('ok', false, 'error', 'You already own 5 crews'); END IF;

  _slug := regexp_replace(lower(trim(_name)), '[^a-z0-9]+', '-', 'g');
  _slug := trim(both '-' from left(_slug, 30));
  IF _slug = '' THEN _slug := 'crew'; END IF;
  _slug := _slug || '-' || substr(md5(gen_random_uuid()::text), 1, 4);

  INSERT INTO public.crews (slug, name, tagline, description, badge_emoji, visibility, accent, join_policy, owner_id)
  VALUES (
    _slug,
    left(trim(_name), 40),
    nullif(left(coalesce(trim(_tagline), ''), 90), ''),
    nullif(left(coalesce(trim(_description), ''), 400), ''),
    coalesce(nullif(trim(_badge_emoji), ''), '🛡️'),
    CASE WHEN _visibility = 'private' THEN 'private' ELSE 'public' END,
    CASE WHEN _accent IN ('teal','violet','amber','rose','emerald','sky','slate') THEN _accent ELSE 'teal' END,
    CASE WHEN _join_policy = 'open' THEN 'open' ELSE 'invite' END,
    _uid
  )
  RETURNING id INTO _id;

  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (_id, _uid, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'slug', _slug);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_crew(_crew_id uuid) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _crew public.crews;
  _count integer;
  _invited boolean;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not signed in'); END IF;
  IF public.is_banned(_uid) THEN RETURN jsonb_build_object('ok', false, 'error', 'account restricted'); END IF;

  SELECT * INTO _crew FROM public.crews WHERE id = _crew_id;
  IF _crew.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'crew not found'); END IF;

  IF EXISTS (SELECT 1 FROM public.crew_members WHERE crew_id = _crew_id AND user_id = _uid) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.crew_invites WHERE crew_id = _crew_id AND user_id = _uid) INTO _invited;

  IF NOT _invited AND NOT (_crew.join_policy = 'open' AND _crew.visibility = 'public') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This crew is invite-only');
  END IF;

  SELECT count(*) INTO _count FROM public.crew_members WHERE crew_id = _crew_id;
  IF _count >= _crew.member_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This crew is full');
  END IF;

  INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (_crew_id, _uid, 'member')
  ON CONFLICT DO NOTHING;
  DELETE FROM public.crew_invites WHERE crew_id = _crew_id AND user_id = _uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_crew(_crew_id uuid, _patch jsonb) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not signed in'); END IF;
  IF NOT (public.is_crew_manager(_crew_id, _uid) OR public.is_staff(_uid)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not allowed');
  END IF;

  UPDATE public.crews SET
    name = coalesce(nullif(left(trim(_patch->>'name'), 40), ''), name),
    tagline = CASE WHEN _patch ? 'tagline' THEN nullif(left(coalesce(trim(_patch->>'tagline'), ''), 90), '') ELSE tagline END,
    description = CASE WHEN _patch ? 'description' THEN nullif(left(coalesce(trim(_patch->>'description'), ''), 400), '') ELSE description END,
    badge_emoji = coalesce(nullif(trim(_patch->>'badge_emoji'), ''), badge_emoji),
    banner_url = CASE WHEN _patch ? 'banner_url' THEN nullif(_patch->>'banner_url', '') ELSE banner_url END,
    accent = CASE WHEN _patch->>'accent' IN ('teal','violet','amber','rose','emerald','sky','slate') THEN _patch->>'accent' ELSE accent END,
    visibility = CASE WHEN _patch->>'visibility' IN ('public','private') THEN _patch->>'visibility' ELSE visibility END,
    join_policy = CASE WHEN _patch->>'join_policy' IN ('open','invite') THEN _patch->>'join_policy' ELSE join_policy END
  WHERE id = _crew_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_crew(text, text, text, text, text, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.join_crew(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.update_crew(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_crew(text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_crew(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_crew(uuid, jsonb) TO authenticated;