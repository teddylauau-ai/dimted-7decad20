CREATE OR REPLACE FUNCTION public.pulse_finish(_level integer, _pct integer, _time_ms integer, _coins integer, _practice boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  st public.pulse_state;
  lvl integer := greatest(1, least(coalesce(_level, 1), 30));
  pct integer := greatest(0, least(coalesce(_pct, 0), 100));
  ms integer := greatest(0, least(coalesce(_time_ms, 0), 3600000));
  coin_mask integer := greatest(0, least(coalesce(_coins, 0), 7));
  existing public.game_progress;
  new_coins integer := 0;
  reward integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(auth.uid()) THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  st := public.pulse_state_for_me();

  IF coalesce(_practice, false) THEN
    RETURN jsonb_build_object('status', 'practice', 'coins', st.coins);
  END IF;

  SELECT * INTO existing FROM public.game_progress
  WHERE user_id = auth.uid() AND game = 'pulse-rush' AND level = lvl LIMIT 1;

  IF existing.id IS NULL THEN
    new_coins := (coin_mask & 1) + ((coin_mask >> 1) & 1) + ((coin_mask >> 2) & 1);
    INSERT INTO public.game_progress (user_id, game, level, stars, best_ms, best_pct, coins, attempts)
    VALUES (auth.uid(), 'pulse-rush', lvl,
            CASE WHEN pct >= 100 THEN 1 ELSE 0 END,
            CASE WHEN pct >= 100 THEN ms ELSE NULL END,
            pct, coin_mask, 1);
    reward := CASE WHEN pct >= 100 THEN 120 + lvl * 20
                   ELSE greatest(2, pct / 2)
              END + new_coins * 45;
  ELSE
    new_coins := ((coin_mask & ~existing.coins) & 1)
               + (((coin_mask & ~existing.coins) >> 1) & 1)
               + (((coin_mask & ~existing.coins) >> 2) & 1);
    reward := CASE
                WHEN pct >= 100 AND coalesce(existing.best_pct, 0) < 100 THEN 120 + lvl * 20
                WHEN pct >= 100 THEN 15 + lvl * 2
                WHEN pct > coalesce(existing.best_pct, 0) THEN greatest(3, (pct - existing.best_pct) * 2)
                ELSE 0
              END + new_coins * 45;
    UPDATE public.game_progress
    SET best_pct = greatest(coalesce(existing.best_pct, 0), pct),
        coins = existing.coins | coin_mask,
        stars = greatest(coalesce(existing.stars, 0), CASE WHEN pct >= 100 THEN 1 ELSE 0 END),
        attempts = coalesce(existing.attempts, 0) + 1,
        best_ms = CASE WHEN pct >= 100 THEN least(coalesce(existing.best_ms, ms), ms) ELSE existing.best_ms END
    WHERE id = existing.id;
  END IF;

  IF reward > 0 THEN
    UPDATE public.pulse_state SET coins = coins + reward WHERE user_id = auth.uid() RETURNING * INTO st;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'coins', st.coins, 'gained', reward,
                            'level', lvl, 'pct', pct, 'new_coins', new_coins);
END;
$$;

REVOKE ALL ON FUNCTION public.pulse_finish(integer, integer, integer, integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.pulse_finish(integer, integer, integer, integer, boolean) TO authenticated;