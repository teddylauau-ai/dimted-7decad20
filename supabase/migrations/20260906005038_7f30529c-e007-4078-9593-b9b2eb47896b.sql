DO $$
DECLARE
  src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'award_arcade_xp';

  IF src IS NULL THEN
    RAISE EXCEPTION 'award_arcade_xp not found';
  END IF;

  IF position('tower-stack' in src) = 0 THEN
    src := replace(
      src,
      '''nova-blocks'', ''aurora-drift'', ''pulse-grid'',',
      '''nova-blocks'', ''aurora-drift'', ''pulse-grid'', ''tower-stack'', ''lane-hop'', ''echo-sequence'', ''neon-coil'','
    );
    IF position('tower-stack' in src) = 0 THEN
      RAISE EXCEPTION 'could not locate game whitelist in award_arcade_xp';
    END IF;
    EXECUTE src;
  END IF;
END $$;