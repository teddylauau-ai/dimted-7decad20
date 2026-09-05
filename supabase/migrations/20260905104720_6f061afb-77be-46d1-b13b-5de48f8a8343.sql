CREATE OR REPLACE FUNCTION public.clamp_crew_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.total_xp IS NULL OR NEW.total_xp < 0 THEN NEW.total_xp := 0; END IF;
  IF NEW.total_xp > 506530 THEN NEW.total_xp := 506530; END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.clamp_crew_contribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.contributed_xp IS NULL OR NEW.contributed_xp < 0 THEN NEW.contributed_xp := 0; END IF;
  IF NEW.contributed_xp > 506530 THEN NEW.contributed_xp := 506530; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS clamp_crew_xp_trg ON public.crews;
CREATE TRIGGER clamp_crew_xp_trg
BEFORE INSERT OR UPDATE ON public.crews
FOR EACH ROW EXECUTE FUNCTION public.clamp_crew_xp();

DROP TRIGGER IF EXISTS clamp_crew_contribution_trg ON public.crew_members;
CREATE TRIGGER clamp_crew_contribution_trg
BEFORE INSERT OR UPDATE ON public.crew_members
FOR EACH ROW EXECUTE FUNCTION public.clamp_crew_contribution();

UPDATE public.crews SET total_xp = 506530 WHERE total_xp > 506530;
UPDATE public.crew_members SET contributed_xp = 506530 WHERE contributed_xp > 506530;

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
    avatar_url = CASE WHEN _patch ? 'avatar_url' THEN nullif(_patch->>'avatar_url', '') ELSE avatar_url END,
    accent = CASE WHEN _patch->>'accent' IN ('teal','violet','amber','rose','emerald','sky','slate') THEN _patch->>'accent' ELSE accent END,
    visibility = CASE WHEN _patch->>'visibility' IN ('public','private') THEN _patch->>'visibility' ELSE visibility END,
    join_policy = CASE WHEN _patch->>'join_policy' IN ('open','invite') THEN _patch->>'join_policy' ELSE join_policy END,
    badge_style = CASE WHEN _patch->>'badge_style' IN ('plain','ring','plate','crest','holo','pulse','aurora','eclipse','sovereign','centurion') THEN _patch->>'badge_style' ELSE badge_style END,
    nametag_style = CASE WHEN _patch->>'nametag_style' IN ('none','accent','glow','gradient','outline','mono','prism','aurora','sovereign') THEN _patch->>'nametag_style' ELSE nametag_style END,
    text_effect = CASE WHEN _patch->>'text_effect' IN ('none','glow','shimmer','sharp','soft','wave','pulse','prism') THEN _patch->>'text_effect' ELSE text_effect END,
    chat_bg = CASE WHEN _patch->>'chat_bg' IN ('none','grid','aurora','stars','waves','circuit','glass','nebula','eclipse','sovereign') THEN _patch->>'chat_bg' ELSE chat_bg END
  WHERE id = _crew_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_crew(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_crew(uuid, jsonb) TO authenticated;