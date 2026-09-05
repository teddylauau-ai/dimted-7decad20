-- 1. Now playing on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS now_playing_kind text,
  ADD COLUMN IF NOT EXISTS now_playing_id text,
  ADD COLUMN IF NOT EXISTS now_playing_url text,
  ADD COLUMN IF NOT EXISTS now_playing_note text,
  ADD COLUMN IF NOT EXISTS now_playing_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_now_playing(
  _kind text,
  _id text,
  _url text,
  _note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  IF _kind IS NULL OR _id IS NULL THEN
    UPDATE public.profiles
       SET now_playing_kind = NULL,
           now_playing_id = NULL,
           now_playing_url = NULL,
           now_playing_note = NULL,
           now_playing_at = NULL
     WHERE id = auth.uid();
    RETURN;
  END IF;

  IF _kind NOT IN ('track','album','artist','playlist','episode','show') THEN
    RAISE EXCEPTION 'bad kind';
  END IF;

  UPDATE public.profiles
     SET now_playing_kind = _kind,
         now_playing_id = left(_id, 64),
         now_playing_url = left(coalesce(_url, ''), 300),
         now_playing_note = nullif(left(coalesce(_note, ''), 140), ''),
         now_playing_at = now()
   WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_now_playing(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_now_playing(text, text, text, text) TO authenticated;

-- 2. Automatic season rollover
CREATE OR REPLACE FUNCTION public.ensure_active_season()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur public.seasons;
  template_id uuid;
  new_id uuid;
  next_num int;
  start_at timestamptz;
  span interval;
BEGIN
  SELECT * INTO cur
    FROM public.seasons
   WHERE active
   ORDER BY starts_at DESC
   LIMIT 1;

  -- Live season: nothing to do.
  IF cur.id IS NOT NULL AND cur.ends_at > now() THEN
    RETURN cur.id;
  END IF;

  -- Expired: retire it and roll straight into the next one.
  IF cur.id IS NOT NULL THEN
    UPDATE public.seasons SET active = false WHERE id = cur.id;
  END IF;

  SELECT id INTO template_id
    FROM public.seasons
   ORDER BY starts_at DESC
   LIMIT 1;

  SELECT count(*)::int + 1 INTO next_num FROM public.seasons;

  span := COALESCE(cur.ends_at - cur.starts_at, interval '30 days');
  start_at := COALESCE(cur.ends_at, now());
  -- If the previous season ended long ago, start now instead of in the past.
  IF start_at < now() - span THEN
    start_at := now();
  END IF;

  INSERT INTO public.seasons (name, starts_at, ends_at, active)
  VALUES ('Season ' || next_num, start_at, start_at + span, true)
  RETURNING id INTO new_id;

  IF template_id IS NOT NULL THEN
    INSERT INTO public.season_tiers
      (season_id, tier, reward_type, reward_value, cosmetic_slug, title_slug, description)
    SELECT new_id, t.tier, t.reward_type, t.reward_value, t.cosmetic_slug, t.title_slug, t.description
      FROM public.season_tiers t
     WHERE t.season_id = template_id
     ORDER BY t.tier;
  END IF;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_active_season() FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_active_season() TO anon, authenticated;