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
    need := round((90 + 9 * power(lvl - 1, 1.5)) / 10) * 10;
    EXIT WHEN acc + need > xp;
    acc := acc + need;
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.level_from_xp(integer) FROM anon;