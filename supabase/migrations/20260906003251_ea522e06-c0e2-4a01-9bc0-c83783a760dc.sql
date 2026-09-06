ALTER TABLE public.crews DROP CONSTRAINT IF EXISTS crews_accent_check;
ALTER TABLE public.crews ADD CONSTRAINT crews_accent_check CHECK (accent = ANY (ARRAY[
  'teal','violet','amber','rose','emerald','sky','slate',
  'flux','sunfire','glacier','orchid','toxin','deepwater','prism','sovereign'
]));

CREATE OR REPLACE FUNCTION public.create_crew(_name text, _tagline text, _badge_emoji text, _visibility text, _accent text, _join_policy text, _description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    CASE WHEN _accent IN ('teal','violet','amber','rose','emerald','sky','slate','flux','sunfire','glacier','orchid','toxin','deepwater','prism','sovereign') THEN _accent ELSE 'teal' END,
    CASE WHEN _join_policy = 'open' THEN 'open' ELSE 'invite' END,
    _uid
  )
  RETURNING id INTO _id;

  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (_id, _uid, 'owner')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'id', _id, 'slug', _slug);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_crew(_crew_id uuid, _patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    avatar_url = CASE WHEN _patch ? 'avatar_url' THEN nullif(_patch->>'avatar_url', '') ELSE avatar_url END,
    accent = CASE WHEN _patch->>'accent' IN ('teal','violet','amber','rose','emerald','sky','slate','flux','sunfire','glacier','orchid','toxin','deepwater','prism','sovereign') THEN _patch->>'accent' ELSE accent END,
    visibility = CASE WHEN _patch->>'visibility' IN ('public','private') THEN _patch->>'visibility' ELSE visibility END,
    join_policy = CASE WHEN _patch->>'join_policy' IN ('open','invite') THEN _patch->>'join_policy' ELSE join_policy END,
    badge_style = CASE WHEN _patch->>'badge_style' IN ('plain','ring','plate','crest','holo','pulse','aurora','eclipse','sovereign','centurion','etched','orbit','prism','void') THEN _patch->>'badge_style' ELSE badge_style END,
    nametag_style = CASE WHEN _patch->>'nametag_style' IN ('none','accent','glow','gradient','outline','mono','prism','aurora','sovereign','shadow','chrome','ember') THEN _patch->>'nametag_style' ELSE nametag_style END,
    text_effect = CASE WHEN _patch->>'text_effect' IN ('none','glow','shimmer','sharp','soft','wave','pulse','prism','neon','chrome','gradient','glitch','flare','quiet','bold','spaced','ghost') THEN _patch->>'text_effect' ELSE text_effect END,
    chat_bg = CASE WHEN _patch->>'chat_bg' IN ('none','grid','aurora','stars','waves','circuit','glass','nebula','eclipse','sovereign','ember','hex','matrix','bloom','void','prism','dunes','orbit','storm','shards','lattice') THEN _patch->>'chat_bg' ELSE chat_bg END
  WHERE id = _crew_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;