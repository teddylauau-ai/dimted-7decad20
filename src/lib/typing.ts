import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TypingScope = "dm" | "channel";

/** Anything older than this is treated as "stopped typing". */
const STALE_MS = 6000;

/**
 * Who else is typing in this chat. Poll-based (same cadence as messages) so it
 * works in every chat surface without a realtime subscription.
 */
export function useTypingUsers(
  scopeType: TypingScope,
  scopeId: string | undefined,
  meId: string | undefined,
) {
  const query = useQuery({
    queryKey: ["typing", scopeType, scopeId],
    enabled: !!scopeId,
    refetchInterval: 2000,
    queryFn: async () => {
      const since = new Date(Date.now() - STALE_MS).toISOString();
      const { data, error } = await supabase
        .from("typing_signals")
        .select("user_id, updated_at, profile:profiles!typing_signals_user_id_fkey (id, username, display_name)")
        .eq("scope_type", scopeType)
        .eq("scope_id", scopeId!)
        .gte("updated_at", since);
      if (error) throw error;
      return (data ?? []) as unknown as {
        user_id: string;
        updated_at: string;
        profile: { id: string; username: string; display_name: string } | null;
      }[];
    },
  });

  return useMemo(
    () =>
      (query.data ?? [])
        .filter((row) => row.user_id !== meId)
        .map((row) => row.profile?.display_name || row.profile?.username || "Someone"),
    [query.data, meId],
  );
}

/**
 * Returns a `signal()` to call on each keystroke. Writes are throttled to one
 * every 2.5s, and the signal is cleared on send / unmount.
 */
export function useTypingSignal(scopeType: TypingScope, scopeId: string | undefined) {
  const lastRef = useRef(0);
  const scopeRef = useRef(scopeId);
  scopeRef.current = scopeId;

  const clear = () => {
    const id = scopeRef.current;
    lastRef.current = 0;
    if (id) void supabase.rpc("clear_typing", { _scope_type: scopeType, _scope_id: id });
  };

  useEffect(() => {
    return () => {
      const id = scopeRef.current;
      if (id) void supabase.rpc("clear_typing", { _scope_type: scopeType, _scope_id: id });
    };
  }, [scopeType, scopeId]);

  const signal = () => {
    const id = scopeRef.current;
    if (!id) return;
    const now = Date.now();
    if (now - lastRef.current < 2500) return;
    lastRef.current = now;
    void supabase.rpc("touch_typing", { _scope_type: scopeType, _scope_id: id });
  };

  return { signal, clear };
}

export function typingLabel(names: string[]) {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} more are typing…`;
}
