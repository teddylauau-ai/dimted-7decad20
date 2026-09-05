CREATE OR REPLACE FUNCTION public.trim_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF random() < 0.02 THEN
    DELETE FROM public.notifications WHERE created_at < now() - interval '30 days';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trim_notifications() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trim_notifications ON public.notifications;
CREATE TRIGGER trg_trim_notifications AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trim_notifications();

CREATE OR REPLACE FUNCTION public.trim_xp_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF random() < 0.01 THEN
    DELETE FROM public.xp_events WHERE created_at < now() - interval '45 days';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trim_xp_events() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trim_xp_events ON public.xp_events;
CREATE TRIGGER trg_trim_xp_events AFTER INSERT ON public.xp_events
FOR EACH ROW EXECUTE FUNCTION public.trim_xp_events();

CREATE OR REPLACE FUNCTION public.trim_signal_scratch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF random() < 0.05 THEN
    DELETE FROM public.call_signals WHERE created_at < now() - interval '30 minutes';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trim_signal_scratch() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trim_call_signals ON public.call_signals;
CREATE TRIGGER trg_trim_call_signals AFTER INSERT ON public.call_signals
FOR EACH ROW EXECUTE FUNCTION public.trim_signal_scratch();

CREATE OR REPLACE FUNCTION public.trim_typing_signals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF random() < 0.05 THEN
    DELETE FROM public.typing_signals WHERE updated_at < now() - interval '1 hour';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trim_typing_signals() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_trim_typing_signals ON public.typing_signals;
CREATE TRIGGER trg_trim_typing_signals AFTER INSERT ON public.typing_signals
FOR EACH ROW EXECUTE FUNCTION public.trim_typing_signals();

DELETE FROM public.notifications WHERE created_at < now() - interval '30 days';
DELETE FROM public.xp_events WHERE created_at < now() - interval '45 days';
DELETE FROM public.call_signals WHERE created_at < now() - interval '30 minutes';