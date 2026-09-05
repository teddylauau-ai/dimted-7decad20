-- Level 100 = 355550 XP total (sum of round((90 + 9*(l-1)^1.5)/10)*10 for l in 1..99)
CREATE OR REPLACE FUNCTION public.clamp_profile_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total_xp := least(greatest(0, coalesce(NEW.total_xp, 0)), 355550);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clamp_profile_xp_trg ON public.profiles;
CREATE TRIGGER clamp_profile_xp_trg
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.clamp_profile_xp();

-- Crew ladder tops out at level 100 = 900 * 99^2 = 8821900 shared XP.
CREATE OR REPLACE FUNCTION public.clamp_crew_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total_xp := least(greatest(0, coalesce(NEW.total_xp, 0)), 8821900);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clamp_crew_xp_trg ON public.crews;
CREATE TRIGGER clamp_crew_xp_trg
BEFORE INSERT OR UPDATE ON public.crews
FOR EACH ROW EXECUTE FUNCTION public.clamp_crew_xp();

CREATE OR REPLACE FUNCTION public.clamp_crew_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.contributed_xp := least(greatest(0, coalesce(NEW.contributed_xp, 0)), 8821900);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clamp_crew_contribution_trg ON public.crew_members;
CREATE TRIGGER clamp_crew_contribution_trg
BEFORE INSERT OR UPDATE ON public.crew_members
FOR EACH ROW EXECUTE FUNCTION public.clamp_crew_contribution();

-- Season pass: 50 tiers x 1000 XP each.
CREATE OR REPLACE FUNCTION public.clamp_season_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.xp := least(greatest(0, coalesce(NEW.xp, 0)), 50000);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clamp_season_xp_trg ON public.season_progress;
CREATE TRIGGER clamp_season_xp_trg
BEFORE INSERT OR UPDATE ON public.season_progress
FOR EACH ROW EXECUTE FUNCTION public.clamp_season_xp();

-- Pull anything already over the ceiling back down.
UPDATE public.profiles SET total_xp = 355550 WHERE total_xp > 355550;
UPDATE public.crews SET total_xp = 8821900 WHERE total_xp > 8821900;
UPDATE public.crew_members SET contributed_xp = 8821900 WHERE contributed_xp > 8821900;
UPDATE public.season_progress SET xp = 50000 WHERE xp > 50000;