/**
 * Global incoming-call popup.
 *
 * When someone starts a call in a DM or crew you're part of, a phone-style
 * card drops down over whatever page you're on: the caller's picture with
 * pulsing rings, a green answer button and a red decline button, plus a
 * soft two-tone ring. Answering hands the call off to that chat's CallPanel
 * (see requestJoinCall in lib/calls) and navigates you there; declining
 * dismisses the ring for that call only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PhoneCall, PhoneOff, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDimted } from "@/lib/dimted-store";
import { requestJoinCall, type CallRow } from "@/lib/calls";
import { Avatar } from "@/components/dimted/Identity";

type Ringing = {
  call: CallRow;
  callerName: string;
  callerProfile: Record<string, unknown> | null;
  place: string; // "Direct call" or the crew name
};

const RING_TTL_MS = 45_000;

/** Soft two-tone phone ring built with WebAudio — no asset needed. */
function useRingtone(active: boolean) {
  const ref = useRef<{ ctx: AudioContext; timer: number } | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.05;
      master.connect(ctx.destination);

      const beep = (freq: number, at: number, len: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(1, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
        osc.connect(gain).connect(master);
        osc.start(at);
        osc.stop(at + len + 0.05);
      };

      const ring = () => {
        if (stopped) return;
        const t = ctx.currentTime;
        beep(880, t, 0.35);
        beep(660, t + 0.4, 0.35);
      };
      ring();
      const timer = window.setInterval(ring, 1600);
      ref.current = { ctx, timer };
    } catch {
      /* autoplay blocked before any user gesture — silent ring, still fine */
    }
    return () => {
      stopped = true;
      if (ref.current) {
        window.clearInterval(ref.current.timer);
        void ref.current.ctx.close().catch(() => {});
        ref.current = null;
      }
    };
  }, [active]);
}

export function IncomingCallToast() {
  const { session, profile } = useDimted();
  const meId = profile?.id ?? session?.user?.id ?? null;
  const navigate = useNavigate();
  const [ringing, setRinging] = useState<Ringing | null>(null);
  const declined = useRef(new Set<string>());
  const seenAt = useRef(new Map<string, number>());

  // Live calls I could join (row-level security already limits this to my
  // own DMs and crews), newest first.
  const live = useQuery({
    queryKey: ["incoming-calls", meId],
    enabled: !!meId,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("id, scope_type, scope_id, started_by, video, ended_at, created_at")
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as CallRow[];
    },
  });

  // Calls I'm already talking in — never ring myself.
  const mine = useQuery({
    queryKey: ["my-call-seats", meId],
    enabled: !!meId,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_participants")
        .select("call_id")
        .eq("user_id", meId!)
        .is("left_at", null);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.call_id as string));
    },
  });

  // Pick the newest fresh call that isn't mine, I'm not in, and I haven't
  // declined — then resolve the caller's name and the place it's ringing.
  useEffect(() => {
    if (!meId) return;
    const now = Date.now();
    const candidate = (live.data ?? []).find((c) => {
      if (c.started_by === meId) return false;
      if (mine.data?.has(c.id)) return false;
      if (declined.current.has(c.id)) return false;
      const firstSeen = seenAt.current.get(c.id);
      if (firstSeen && now - firstSeen > RING_TTL_MS) return false;
      seenAt.current.set(c.id, firstSeen ?? now);
      return true;
    });

    if (!candidate) {
      setRinging((cur) => (cur && live.data?.some((c) => c.id === cur.call.id) ? cur : null));
      return;
    }
    if (ringing?.call.id === candidate.id) return;

    let cancelled = false;
    void (async () => {
      const [{ data: caller }, crewRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", candidate.started_by)
          .maybeSingle(),
        candidate.scope_type === "crew"
          ? supabase.from("crews").select("name").eq("id", candidate.scope_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (cancelled) return;
      setRinging({
        call: candidate,
        callerName: (caller?.display_name as string | undefined) ?? "Someone",
        callerProfile: (caller as Record<string, unknown> | null) ?? null,
        place:
          candidate.scope_type === "crew"
            ? ((crewRes.data?.name as string | undefined) ?? "Crew call")
            : "Direct call",
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.data, mine.data, meId]);

  // Auto-decline after the ring times out.
  useEffect(() => {
    if (!ringing) return;
    const t = window.setTimeout(() => {
      declined.current.add(ringing.call.id);
      setRinging(null);
    }, RING_TTL_MS);
    return () => window.clearTimeout(t);
  }, [ringing]);

  useRingtone(!!ringing);

  const answer = useCallback(() => {
    if (!ringing) return;
    const { scope_type, scope_id, video } = ringing.call;
    requestJoinCall(scope_type as "dm" | "crew", scope_id, video);
    setRinging(null);
    if (scope_type === "crew") {
      void navigate({ to: "/crews" });
    } else {
      void navigate({ to: "/messages" });
    }
  }, [ringing, navigate]);

  const decline = useCallback(() => {
    if (!ringing) return;
    declined.current.add(ringing.call.id);
    setRinging(null);
  }, [ringing]);

  if (!ringing) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-3">
      <div className="pointer-events-auto glass-raised animate-in slide-in-from-top-6 fade-in flex w-full max-w-sm items-center gap-4 rounded-3xl border border-primary/40 p-4 shadow-[0_0_50px_-10px_hsl(var(--primary)/0.5)] duration-300">
        {/* Pulsing rings behind the caller's picture, like a phone lockscreen. */}
        <div className="relative shrink-0">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/25" />
          <span className="absolute -inset-1.5 animate-pulse rounded-full border border-primary/40" />
          {ringing.callerProfile ? (
            <Avatar profile={ringing.callerProfile as never} size={52} presence={false} />
          ) : (
            <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-primary/20 text-lg font-bold text-primary">
              {ringing.callerName[0]?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold">
            {ringing.callerName}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {ringing.call.video ? (
              <Video className="h-3.5 w-3.5 text-primary" />
            ) : (
              <PhoneCall className="h-3.5 w-3.5 text-primary" />
            )}
            {ringing.call.video ? "Video" : "Voice"} call · {ringing.place}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={decline}
            aria-label="Decline call"
            className="grid h-11 w-11 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={answer}
            aria-label="Answer call"
            className="grid h-11 w-11 animate-[pulse_1.2s_ease-in-out_infinite] place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_20px_-2px_rgba(16,185,129,0.7)] transition-transform hover:scale-105 active:scale-95"
          >
            <PhoneCall className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
