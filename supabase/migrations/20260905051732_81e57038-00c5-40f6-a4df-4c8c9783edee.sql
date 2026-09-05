DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crew_role') THEN
    CREATE TYPE public.crew_role AS ENUM ('owner', 'captain', 'member');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.crews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  badge_emoji TEXT NOT NULL DEFAULT '🏴‍☠️',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  total_xp INTEGER NOT NULL DEFAULT 0,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crew_members (
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.crew_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (crew_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.crew_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (crew_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.crew_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  reply_to_id UUID REFERENCES public.crew_messages(id) ON DELETE SET NULL,
  audio_url TEXT,
  audio_ms INTEGER,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.season_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('sparks','xp','cosmetic','title','none')),
  reward_value INTEGER NOT NULL DEFAULT 0,
  cosmetic_slug TEXT REFERENCES public.cosmetics(slug) ON DELETE SET NULL,
  title_slug TEXT REFERENCES public.titles(slug) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (season_id, tier)
);

CREATE TABLE IF NOT EXISTS public.season_progress (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  claimed_tiers INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id)
);

CREATE TABLE IF NOT EXISTS public.profile_widgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL CHECK (widget_type IN ('rank','stats','spotify','achievements','showcase','friends','pulse','bio')),
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 1,
  height INTEGER NOT NULL DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, position_x, position_y)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crews TO authenticated;
GRANT ALL ON public.crews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_members TO authenticated;
GRANT ALL ON public.crew_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_invites TO authenticated;
GRANT ALL ON public.crew_invites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_messages TO authenticated;
GRANT ALL ON public.crew_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_tiers TO authenticated;
GRANT ALL ON public.season_tiers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_progress TO authenticated;
GRANT ALL ON public.season_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_widgets TO authenticated;
GRANT ALL ON public.profile_widgets TO service_role;

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crews visible to members and public crews"
  ON public.crews FOR SELECT TO authenticated
  USING (visibility = 'public' OR EXISTS (
    SELECT 1 FROM public.crew_members WHERE crew_id = crews.id AND user_id = auth.uid()
  ));

CREATE POLICY "Owners can create and delete crews"
  ON public.crews FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view their crew memberships"
  ON public.crew_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.crew_members cm WHERE cm.crew_id = crew_members.crew_id AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Owners and captains can manage members"
  ON public.crew_members FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.crew_members cm
    WHERE cm.crew_id = crew_members.crew_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','captain')
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.crew_members cm
    WHERE cm.crew_id = crew_members.crew_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','captain')
  ));

CREATE POLICY "Users can view their own crew invites"
  ON public.crew_invites FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR invited_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.crew_members cm WHERE cm.crew_id = crew_invites.crew_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','captain')
  ));

CREATE POLICY "Owners and captains can invite"
  ON public.crew_invites FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.crew_members cm
    WHERE cm.crew_id = crew_invites.crew_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','captain')
  ));

CREATE POLICY "Invitees and managers can delete invites"
  ON public.crew_invites FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR invited_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.crew_members cm
    WHERE cm.crew_id = crew_invites.crew_id AND cm.user_id = auth.uid() AND cm.role IN ('owner','captain')
  ));

CREATE POLICY "Crew members can view and send messages"
  ON public.crew_messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.crew_members cm WHERE cm.crew_id = crew_messages.crew_id AND cm.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.crew_members cm WHERE cm.crew_id = crew_messages.crew_id AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Seasons are readable by all signed-in users"
  ON public.seasons FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only staff can manage seasons"
  ON public.seasons FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Season tiers are readable by all signed-in users"
  ON public.season_tiers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only staff can manage season tiers"
  ON public.season_tiers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Users can view and update their own season progress"
  ON public.season_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage their own profile widgets"
  ON public.profile_widgets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS crews_owner_idx ON public.crews (owner_id);
CREATE INDEX IF NOT EXISTS crews_slug_idx ON public.crews (slug);
CREATE INDEX IF NOT EXISTS crew_members_user_idx ON public.crew_members (user_id);
CREATE INDEX IF NOT EXISTS crew_invites_user_idx ON public.crew_invites (user_id);
CREATE INDEX IF NOT EXISTS crew_invites_crew_idx ON public.crew_invites (crew_id);
CREATE INDEX IF NOT EXISTS crew_messages_crew_idx ON public.crew_messages (crew_id, created_at DESC);
CREATE INDEX IF NOT EXISTS season_tiers_season_idx ON public.season_tiers (season_id, tier);
CREATE INDEX IF NOT EXISTS profile_widgets_user_idx ON public.profile_widgets (user_id, position_y, position_x);

CREATE OR REPLACE FUNCTION public.is_crew_member(_crew_id uuid, _user_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crew_members
    WHERE crew_id = _crew_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_crew_manager(_crew_id uuid, _user_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crew_members
    WHERE crew_id = _crew_id AND user_id = _user_id AND role IN ('owner','captain')
  );
$$;

CREATE OR REPLACE FUNCTION public.add_crew_xp(_crew_id uuid, _amount integer)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.crews SET total_xp = total_xp + _amount, updated_at = now()
  WHERE id = _crew_id;
$$;

CREATE OR REPLACE FUNCTION public.touch_crew_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_crews_updated_at ON public.crews;
CREATE TRIGGER update_crews_updated_at
BEFORE UPDATE ON public.crews
FOR EACH ROW EXECUTE FUNCTION public.touch_crew_updated_at();

CREATE OR REPLACE FUNCTION public.add_member_to_crew(_crew_id uuid, _user_id uuid, _role text DEFAULT 'member')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.crew_members WHERE crew_id = _crew_id;
  IF v_count >= 25 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Crew is full (max 25 members)');
  END IF;

  IF EXISTS (SELECT 1 FROM public.crew_invites WHERE crew_id = _crew_id AND user_id = _user_id) THEN
    DELETE FROM public.crew_invites WHERE crew_id = _crew_id AND user_id = _user_id;
  END IF;

  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (_crew_id, _user_id, _role::public.crew_role)
  ON CONFLICT (crew_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_season_tier(_season_id uuid, _tier integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_xp_needed integer := _tier * 1000;
  v_progress public.season_progress%ROWTYPE;
  v_tier public.season_tiers%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_tier FROM public.season_tiers
  WHERE season_id = _season_id AND tier = _tier;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tier not found');
  END IF;

  SELECT * INTO v_progress FROM public.season_progress
  WHERE user_id = v_user_id AND season_id = _season_id;
  IF NOT FOUND THEN
    INSERT INTO public.season_progress (user_id, season_id, xp) VALUES (v_user_id, _season_id, 0)
    RETURNING * INTO v_progress;
  END IF;

  IF v_progress.xp < v_xp_needed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough season XP');
  END IF;

  IF _tier = ANY(v_progress.claimed_tiers) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Tier already claimed');
  END IF;

  UPDATE public.season_progress
  SET claimed_tiers = array_append(claimed_tiers, _tier), updated_at = now()
  WHERE user_id = v_user_id AND season_id = _season_id;

  IF v_tier.reward_type = 'sparks' AND v_tier.reward_value > 0 THEN
    UPDATE public.profiles SET sparks = sparks + v_tier.reward_value WHERE id = v_user_id;
  ELSIF v_tier.reward_type = 'xp' AND v_tier.reward_value > 0 THEN
    PERFORM public.award_xp('season_reward', format('Season tier %s reward', _tier));
  ELSIF v_tier.reward_type = 'cosmetic' AND v_tier.cosmetic_slug IS NOT NULL THEN
    INSERT INTO public.inventory (user_id, cosmetic_slug, acquired_at)
    VALUES (v_user_id, v_tier.cosmetic_slug, now())
    ON CONFLICT (user_id, cosmetic_slug) DO NOTHING;
  ELSIF v_tier.reward_type = 'title' AND v_tier.title_slug IS NOT NULL THEN
    INSERT INTO public.titles (slug, label, tier)
    VALUES (v_tier.title_slug, v_tier.title_slug, 1)
    ON CONFLICT (slug) DO NOTHING;
    UPDATE public.profiles SET title = v_tier.title_slug WHERE id = v_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'reward_type', v_tier.reward_type, 'reward_value', v_tier.reward_value);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_season_xp(_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_season_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  SELECT id INTO v_season_id FROM public.seasons WHERE active = true ORDER BY starts_at DESC LIMIT 1;
  IF v_season_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.season_progress (user_id, season_id, xp)
  VALUES (v_user_id, v_season_id, _amount)
  ON CONFLICT (user_id, season_id)
  DO UPDATE SET xp = public.season_progress.xp + _amount, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_season(_name text, _days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_now timestamptz := now();
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Forbidden');
  END IF;

  UPDATE public.seasons SET active = false WHERE active = true;

  INSERT INTO public.seasons (name, starts_at, ends_at, active)
  VALUES (_name, v_now, v_now + (_days || ' days')::interval, true)
  RETURNING id INTO v_season_id;

  RETURN jsonb_build_object('ok', true, 'season_id', v_season_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_profile_widgets(_widgets jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  w jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  DELETE FROM public.profile_widgets WHERE user_id = v_user_id;

  FOR w IN SELECT * FROM jsonb_array_elements(_widgets)
  LOOP
    INSERT INTO public.profile_widgets (user_id, widget_type, position_x, position_y, width, height, config)
    VALUES (
      v_user_id,
      (w->>'widget_type')::text,
      COALESCE((w->>'position_x')::integer, 0),
      COALESCE((w->>'position_y')::integer, 0),
      COALESCE((w->>'width')::integer, 1),
      COALESCE((w->>'height')::integer, 1),
      COALESCE(w->'config', '{}'::jsonb)
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_profile_widgets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  DELETE FROM public.profile_widgets WHERE user_id = v_user_id;

  INSERT INTO public.profile_widgets (user_id, widget_type, position_x, position_y, width, height)
  VALUES
    (v_user_id, 'rank', 0, 0, 2, 1),
    (v_user_id, 'stats', 0, 1, 1, 1),
    (v_user_id, 'showcase', 1, 1, 1, 1),
    (v_user_id, 'bio', 0, 2, 2, 1),
    (v_user_id, 'achievements', 0, 3, 2, 1);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_crew_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_crew_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_crew_xp(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_member_to_crew(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_season_tier(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_season_xp(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_season(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_profile_widgets(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_profile_widgets() TO authenticated;

INSERT INTO public.cosmetics (slug, name, slot, rarity, description, price_sparks, required_level, featured, pool, available_until) VALUES
  ('badge-crew-skull', 'Crew Skull', 'badge', 'rare', 'A badge for tight-knit crews.', 0, 1, false, 'crew', NULL),
  ('badge-crew-anchor', 'Crew Anchor', 'badge', 'epic', 'Steady and loyal.', 0, 1, false, 'crew', NULL),
  ('frame-crew-band', 'Crew Band', 'frame', 'rare', 'A matching frame for the squad.', 0, 1, false, 'crew', NULL),
  ('banner-crew-sigil', 'Crew Sigil', 'banner', 'epic', 'A banner forged together.', 0, 1, false, 'crew', NULL),
  ('tag-crew', 'Crew Ink', 'nametag', 'uncommon', 'Unified name style.', 0, 1, false, 'crew', NULL),
  ('badge-season-legend', 'Season Legend', 'badge', 'mythic', 'Completed an entire season.', 0, 1, true, 'season', NULL),
  ('frame-season-gold', 'Season Gold', 'frame', 'legendary', 'Earned through seasonal dedication.', 0, 1, true, 'season', NULL),
  ('tag-season', 'Season Runner', 'nametag', 'rare', 'Always chasing the next tier.', 0, 1, false, 'season', NULL)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.titles (slug, label, tier) VALUES
  ('season-legend', 'Season Legend', 5)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_season_id uuid;
  v_tier integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE active = true) THEN
    INSERT INTO public.seasons (name, starts_at, ends_at, active)
    VALUES ('Season 1: First Light', now(), now() + interval '30 days', true)
    RETURNING id INTO v_season_id;

    FOR v_tier IN 1..50 LOOP
      INSERT INTO public.season_tiers (season_id, tier, reward_type, reward_value, description)
      VALUES (
        v_season_id,
        v_tier,
        CASE
          WHEN v_tier IN (5,15,25,35,45) THEN 'sparks'
          WHEN v_tier IN (10,20,30,40) THEN 'xp'
          WHEN v_tier = 50 THEN 'cosmetic'
          ELSE 'none'
        END,
        CASE
          WHEN v_tier IN (5,15,25,35,45) THEN v_tier * 10
          WHEN v_tier IN (10,20,30,40) THEN v_tier * 50
          WHEN v_tier = 50 THEN 0
          ELSE 0
        END,
        CASE
          WHEN v_tier = 50 THEN 'Mythic Season Legend badge'
          ELSE format('Tier %s reward', v_tier)
        END
      );
    END LOOP;

    UPDATE public.season_tiers SET cosmetic_slug = 'badge-season-legend' WHERE season_id = v_season_id AND tier = 50;
  END IF;
END $$;