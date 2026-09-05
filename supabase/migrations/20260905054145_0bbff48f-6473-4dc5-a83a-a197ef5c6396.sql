CREATE OR REPLACE FUNCTION public.add_season_xp_for(_user_id uuid, _amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
BEGIN
  IF _user_id IS NULL OR coalesce(_amount, 0) <= 0 THEN RETURN; END IF;
  SELECT id INTO v_season_id FROM public.seasons WHERE active = true ORDER BY starts_at DESC LIMIT 1;
  IF v_season_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.season_progress (user_id, season_id, xp)
  VALUES (_user_id, v_season_id, _amount)
  ON CONFLICT (user_id, season_id)
  DO UPDATE SET xp = season_progress.xp + excluded.xp, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.add_season_xp(_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.add_season_xp_for(auth.uid(), _amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.season_xp_from_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source <> 'season' THEN
    PERFORM public.add_season_xp_for(NEW.user_id, NEW.amount);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS xp_events_season_xp ON public.xp_events;
CREATE TRIGGER xp_events_season_xp
AFTER INSERT ON public.xp_events
FOR EACH ROW EXECUTE FUNCTION public.season_xp_from_event();

REVOKE ALL ON FUNCTION public.add_season_xp_for(uuid, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.season_xp_from_event() FROM public, anon, authenticated;

-- Backfill season XP for the active season from XP earned since it started.
INSERT INTO public.season_progress (user_id, season_id, xp)
SELECT e.user_id, s.id, sum(e.amount)
FROM public.xp_events e
JOIN public.seasons s ON s.active = true
WHERE e.created_at >= s.starts_at AND e.source <> 'season'
GROUP BY e.user_id, s.id
ON CONFLICT (user_id, season_id) DO UPDATE SET xp = greatest(season_progress.xp, excluded.xp), updated_at = now();