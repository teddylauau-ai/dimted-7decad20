CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.game_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  game text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  stars integer NOT NULL DEFAULT 0,
  best_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game, level)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_progress TO authenticated;
GRANT ALL ON public.game_progress TO service_role;

ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can view campaign progress"
  ON public.game_progress FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users manage their own campaign progress"
  ON public.game_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER game_progress_updated_at
  BEFORE UPDATE ON public.game_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.study_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  deck text NOT NULL,
  best_percent integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, deck)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_progress TO authenticated;
GRANT ALL ON public.study_progress TO service_role;

ALTER TABLE public.study_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own study progress"
  ON public.study_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users manage their own study progress"
  ON public.study_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER study_progress_updated_at
  BEFORE UPDATE ON public.study_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();