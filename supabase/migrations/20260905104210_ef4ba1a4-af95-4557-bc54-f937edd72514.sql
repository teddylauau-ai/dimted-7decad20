CREATE OR REPLACE FUNCTION public.level_from_xp(_xp integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE lvl integer := 1; acc integer := 0; need integer; xp integer := greatest(0, coalesce(_xp, 0));
BEGIN
  LOOP
    EXIT WHEN lvl >= 100;
    IF lvl < 70 THEN
      need := round((40 + 4 * power(lvl - 1, 1.35)) / 10) * 10;
    ELSE
      need := round((1200 + 174 * power(lvl - 69, 1.35)) / 10) * 10;
    END IF;
    EXIT WHEN acc + need > xp;
    acc := acc + need;
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END;
$function$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS maxed_at timestamptz;

UPDATE public.profiles SET total_xp = 301580 WHERE total_xp > 301580;

UPDATE public.profiles SET maxed_at = coalesce(maxed_at, now())
WHERE total_xp >= 301580 AND maxed_at IS NULL;

CREATE OR REPLACE FUNCTION public.clamp_profile_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.total_xp IS NULL OR NEW.total_xp < 0 THEN
    NEW.total_xp := 0;
  END IF;
  IF NEW.total_xp > 301580 THEN
    NEW.total_xp := 301580;
  END IF;
  IF NEW.total_xp >= 301580 AND NEW.maxed_at IS NULL THEN
    NEW.maxed_at := now();
  END IF;
  RETURN NEW;
END;
$function$;