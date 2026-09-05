CREATE OR REPLACE FUNCTION public.notify_on_crew_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sender_name text;
  crew_name text;
BEGIN
  IF NEW.body LIKE '/sys:%' THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT name INTO crew_name FROM public.crews WHERE id = NEW.crew_id;

  INSERT INTO public.notifications (user_id, actor_id, kind, title, body, link)
  SELECT m.user_id, NEW.user_id, 'crew',
         coalesce(sender_name, 'Someone') || ' posted in ' || coalesce(crew_name, 'your crew'),
         left(coalesce(nullif(NEW.body, ''), CASE WHEN NEW.audio_url IS NOT NULL THEN 'Voice message' WHEN NEW.image_url IS NOT NULL THEN 'Image' ELSE '' END), 140),
         '/crews'
  FROM public.crew_members m
  WHERE m.crew_id = NEW.crew_id
    AND m.user_id <> NEW.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = m.user_id AND n.kind = 'crew'
        AND n.read_at IS NULL
        AND n.created_at > now() - interval '2 minutes'
    );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.crew_roster_system_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crew_messages (crew_id, user_id, body)
    VALUES (NEW.crew_id, NEW.user_id, '/sys:join');
    RETURN NEW;
  ELSE
    IF EXISTS (SELECT 1 FROM public.crews WHERE id = OLD.crew_id) THEN
      INSERT INTO public.crew_messages (crew_id, user_id, body)
      VALUES (OLD.crew_id, OLD.user_id, '/sys:leave');
    END IF;
    RETURN OLD;
  END IF;
END;
$function$;

DROP TRIGGER IF EXISTS crew_roster_system_message_ins ON public.crew_members;
CREATE TRIGGER crew_roster_system_message_ins
AFTER INSERT ON public.crew_members
FOR EACH ROW EXECUTE FUNCTION public.crew_roster_system_message();

DROP TRIGGER IF EXISTS crew_roster_system_message_del ON public.crew_members;
CREATE TRIGGER crew_roster_system_message_del
AFTER DELETE ON public.crew_members
FOR EACH ROW EXECUTE FUNCTION public.crew_roster_system_message();

REVOKE ALL ON FUNCTION public.crew_roster_system_message() FROM public, anon, authenticated;