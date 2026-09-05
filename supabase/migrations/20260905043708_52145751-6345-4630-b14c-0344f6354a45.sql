ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;
ALTER TABLE public.community_messages ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.community_messages ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS showcase text[] NOT NULL DEFAULT '{}';

CREATE TABLE public.pinned_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('dm','community')),
  scope_id uuid NOT NULL,
  dm_message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  community_message_id uuid REFERENCES public.community_messages(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_id)
);
GRANT SELECT, INSERT, DELETE ON public.pinned_messages TO authenticated;
GRANT ALL ON public.pinned_messages TO service_role;
ALTER TABLE public.pinned_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pins" ON public.pinned_messages FOR SELECT TO authenticated
USING (
  (scope_type = 'dm' AND public.is_friendship_member(scope_id, auth.uid()))
  OR (scope_type = 'community' AND public.is_community_member(scope_id, auth.uid()))
);

CREATE POLICY "Members can pin" ON public.pinned_messages FOR INSERT TO authenticated
WITH CHECK (
  pinned_by = auth.uid() AND (
    (scope_type = 'dm' AND public.is_friendship_member(scope_id, auth.uid()))
    OR (scope_type = 'community' AND public.is_community_member(scope_id, auth.uid()))
  )
);

CREATE POLICY "Members can unpin" ON public.pinned_messages FOR DELETE TO authenticated
USING (
  (scope_type = 'dm' AND public.is_friendship_member(scope_id, auth.uid()))
  OR (scope_type = 'community' AND public.is_community_member(scope_id, auth.uid()))
);

CREATE POLICY "Senders can edit own messages" ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Authors can edit own community messages" ON public.community_messages FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Members can read chat images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-images');

CREATE POLICY "Users can upload chat images to own folder" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own chat images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);