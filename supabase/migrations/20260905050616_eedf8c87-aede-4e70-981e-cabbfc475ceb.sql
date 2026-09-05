CREATE TABLE IF NOT EXISTS public.spotify_picks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('track','album','artist','playlist','episode','show')),
  spotify_id TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, spotify_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spotify_picks TO authenticated;
GRANT ALL ON public.spotify_picks TO service_role;

ALTER TABLE public.spotify_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in members can view all picks"
  ON public.spotify_picks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Members manage their own picks"
  ON public.spotify_picks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS spotify_picks_user_idx ON public.spotify_picks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS spotify_picks_recent_idx ON public.spotify_picks (created_at DESC);