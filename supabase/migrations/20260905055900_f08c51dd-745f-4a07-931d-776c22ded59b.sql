ALTER TABLE public.crews
  ADD COLUMN IF NOT EXISTS badge_style text NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS nametag_style text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS text_effect text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS chat_bg text NOT NULL DEFAULT 'none';

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
    badge_style = CASE WHEN _patch->>'badge_style' IN ('plain','ring','plate','crest','holo','pulse') THEN _patch->>'badge_style' ELSE badge_style END,
    nametag_style = CASE WHEN _patch->>'nametag_style' IN ('none','accent','glow','gradient','outline','mono') THEN _patch->>'nametag_style' ELSE nametag_style END,
    text_effect = CASE WHEN _patch->>'text_effect' IN ('none','glow','shimmer','sharp','soft','wave') THEN _patch->>'text_effect' ELSE text_effect END,
    chat_bg = CASE WHEN _patch->>'chat_bg' IN ('none','grid','aurora','stars','waves','circuit','glass') THEN _patch->>'chat_bg' ELSE chat_bg END
  WHERE id = _crew_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_crew(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_crew(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_on_crew_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  crew_name text;
BEGIN
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT name INTO crew_name FROM public.crews WHERE id = NEW.crew_id;

  INSERT INTO public.notifications (user_id, actor_id, kind, title, body, link)
  SELECT m.user_id, NEW.user_id, 'crew',
         coalesce(sender_name, 'Someone') || ' posted in ' || coalesce(crew_name, 'your crew'),
         left(coalesce(nullif(NEW.body, ''), CASE WHEN NEW.audio_url IS NOT NULL THEN 'Voice message' WHEN NEW.image_url IS NOT NULL THEN 'Image' ELSE '' END), 140),
         '/crews'
  FROM public.crew_members m
  WHERE m.crew_id = NEW.crew_id
    AND m.user_id <> NEW.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = m.user_id AND n.kind = 'crew'
        AND n.read_at IS NULL
        AND n.created_at > now() - interval '2 minutes'
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_crew_message_notify ON public.crew_messages;
CREATE TRIGGER on_crew_message_notify
AFTER INSERT ON public.crew_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_crew_message();