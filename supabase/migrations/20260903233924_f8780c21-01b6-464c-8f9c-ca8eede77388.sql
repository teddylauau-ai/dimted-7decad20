CREATE OR REPLACE FUNCTION public.trim_direct_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.messages m
  WHERE m.friendship_id = NEW.friendship_id
    AND (
      m.created_at < now() - interval '30 days'
      OR m.id IN (
        SELECT id FROM public.messages
        WHERE friendship_id = NEW.friendship_id
        ORDER BY created_at DESC, id DESC
        OFFSET 100
      )
    );
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trim_direct_messages_after_insert ON public.messages;
CREATE TRIGGER trim_direct_messages_after_insert
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trim_direct_messages();

CREATE OR REPLACE FUNCTION public.trim_channel_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.community_messages m
  WHERE m.channel_id = NEW.channel_id
    AND (
      m.created_at < now() - interval '30 days'
      OR m.id IN (
        SELECT id FROM public.community_messages
        WHERE channel_id = NEW.channel_id
        ORDER BY created_at DESC, id DESC
        OFFSET 100
      )
    );
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trim_channel_messages_after_insert ON public.community_messages;
CREATE TRIGGER trim_channel_messages_after_insert
AFTER INSERT ON public.community_messages
FOR EACH ROW EXECUTE FUNCTION public.trim_channel_messages();

REVOKE EXECUTE ON FUNCTION public.trim_direct_messages() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trim_channel_messages() FROM anon, authenticated;