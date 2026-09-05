ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_dm_read(_friendship_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT public.is_friendship_member(_friendship_id, auth.uid()) THEN RETURN; END IF;
  UPDATE public.messages
  SET read_at = now()
  WHERE friendship_id = _friendship_id
    AND sender_id <> auth.uid()
    AND read_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_dm_read(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_dm_read(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.general_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  audio_url text,
  audio_ms integer,
  image_url text,
  edited_at timestamptz,
  reply_to_id uuid REFERENCES public.general_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.general_messages TO authenticated;
GRANT ALL ON public.general_messages TO service_role;

ALTER TABLE public.general_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "general_select_all" ON public.general_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "general_insert_self" ON public.general_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.is_banned(auth.uid()) AND NOT public.is_muted(auth.uid()));

CREATE POLICY "general_update_own" ON public.general_messages
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "general_delete_own_or_staff" ON public.general_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.my_rank() >= 20);

CREATE INDEX IF NOT EXISTS general_messages_created_idx ON public.general_messages (created_at DESC);

CREATE OR REPLACE FUNCTION public.trim_general_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.general_messages g
  WHERE g.id IN (
    SELECT id FROM public.general_messages
    ORDER BY created_at DESC
    OFFSET 200
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trim_general_messages_trg ON public.general_messages;
CREATE TRIGGER trim_general_messages_trg
AFTER INSERT ON public.general_messages
FOR EACH STATEMENT EXECUTE FUNCTION public.trim_general_messages();