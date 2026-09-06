-- Catalogue of buyable Nova Rift content
CREATE TABLE public.rift_items (
  slug text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('level','runner','trail')),
  name text NOT NULL,
  cost_stars integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rift_items TO anon;
GRANT SELECT ON public.rift_items TO authenticated;
GRANT ALL ON public.rift_items TO service_role;
ALTER TABLE public.rift_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rift catalogue is public" ON public.rift_items FOR SELECT USING (true);

CREATE TABLE public.rift_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text NOT NULL REFERENCES public.rift_items(slug) ON DELETE CASCADE,
  cost_stars integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT ON public.rift_unlocks TO authenticated;
GRANT ALL ON public.rift_unlocks TO service_role;
ALTER TABLE public.rift_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own rift unlocks" ON public.rift_unlocks FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.rift_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  equipped_runner text NOT NULL DEFAULT 'aurora',
  equipped_trail text NOT NULL DEFAULT 'ghost',
  stars_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rift_state TO authenticated;
GRANT ALL ON public.rift_state TO service_role;
ALTER TABLE public.rift_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own rift state" ON public.rift_state FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER rift_state_touch BEFORE UPDATE ON public.rift_state
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Catalogue seed: levels 2..12 buyable with stars, plus wardrobe
INSERT INTO public.rift_items (slug, kind, name, cost_stars) VALUES
  ('level:2','level','Step Sequence',3),
  ('level:3','level','Pad Runner',4),
  ('level:4','level','Needle Gate',5),
  ('level:5','level','Double Vision',6),
  ('level:6','level','Sawline',7),
  ('level:7','level','Rift Ascent',8),
  ('level:8','level','Compression',9),
  ('level:9','level','Dash Protocol',10),
  ('level:10','level','Iron Cadence',11),
  ('level:11','level','Voidwalk',12),
  ('level:12','level','Nova Core',13),
  ('runner:ember','runner','Ember',6),
  ('runner:violet','runner','Violet',14),
  ('runner:sentinel','runner','Sentinel',22),
  ('runner:nova','runner','Nova',30),
  ('trail:spark','trail','Spark',4),
  ('trail:ribbon','trail','Ribbon',10),
  ('trail:ember','trail','Ember',18),
  ('trail:prism','trail','Prism',26);

-- Stars earned from saved Nova Rift progress
CREATE OR REPLACE FUNCTION public.rift_stars_earned(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(stars), 0)::int FROM public.game_progress
  WHERE user_id = _user_id AND game = 'nova-rift';
$$;

CREATE OR REPLACE FUNCTION public.rift_state_for_me()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); st public.rift_state;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('error','auth'); END IF;
  SELECT * INTO st FROM public.rift_state WHERE user_id = uid;
  RETURN jsonb_build_object(
    'runner', COALESCE(st.equipped_runner, 'aurora'),
    'trail', COALESCE(st.equipped_trail, 'ghost'),
    'stars_spent', COALESCE(st.stars_spent, 0),
    'stars_earned', public.rift_stars_earned(uid),
    'stars_available', public.rift_stars_earned(uid) - COALESCE(st.stars_spent, 0),
    'unlocks', COALESCE((SELECT jsonb_agg(slug) FROM public.rift_unlocks WHERE user_id = uid), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rift_buy(_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); it public.rift_items; spent int; avail int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('status','error','message','Sign in first'); END IF;
  SELECT * INTO it FROM public.rift_items WHERE slug = _slug;
  IF it.slug IS NULL THEN RETURN jsonb_build_object('status','error','message','Unknown item'); END IF;

  INSERT INTO public.rift_state (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  SELECT stars_spent INTO spent FROM public.rift_state WHERE user_id = uid FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.rift_unlocks WHERE user_id = uid AND slug = _slug) THEN
    RETURN jsonb_build_object('status','owned');
  END IF;

  avail := public.rift_stars_earned(uid) - COALESCE(spent, 0);
  IF avail < it.cost_stars THEN
    RETURN jsonb_build_object('status','poor','need', it.cost_stars, 'have', avail);
  END IF;

  INSERT INTO public.rift_unlocks (user_id, slug, cost_stars) VALUES (uid, _slug, it.cost_stars);
  UPDATE public.rift_state SET stars_spent = COALESCE(stars_spent,0) + it.cost_stars WHERE user_id = uid;

  RETURN jsonb_build_object('status','bought','slug', _slug, 'spent', it.cost_stars,
    'stars_available', public.rift_stars_earned(uid) - (COALESCE(spent,0) + it.cost_stars));
END;
$$;

CREATE OR REPLACE FUNCTION public.rift_equip(_kind text, _slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); free boolean;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('status','error','message','Sign in first'); END IF;
  IF _kind NOT IN ('runner','trail') THEN RETURN jsonb_build_object('status','error','message','Bad slot'); END IF;

  free := NOT EXISTS (SELECT 1 FROM public.rift_items WHERE slug = _kind || ':' || _slug);
  IF NOT free AND NOT EXISTS (SELECT 1 FROM public.rift_unlocks WHERE user_id = uid AND slug = _kind || ':' || _slug) THEN
    RETURN jsonb_build_object('status','locked');
  END IF;

  INSERT INTO public.rift_state (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  IF _kind = 'runner' THEN
    UPDATE public.rift_state SET equipped_runner = _slug WHERE user_id = uid;
  ELSE
    UPDATE public.rift_state SET equipped_trail = _slug WHERE user_id = uid;
  END IF;
  RETURN jsonb_build_object('status','equipped','kind', _kind, 'slug', _slug);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rift_state_for_me() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rift_buy(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rift_equip(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rift_stars_earned(uuid) TO authenticated;