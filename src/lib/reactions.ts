/**
 * Message reactions — small emoji tallies under any chat message, in DMs and
 * community channels. One row per (user, message, emoji); the database enforces
 * uniqueness so double-tapping simply removes your own reaction.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReactionScope = "dm" | "community";

export const REACTION_CHOICES = ["👍", "🔥", "😂", "❤️", "😮", "🎯"] as const;

export type ReactionTally = { emoji: string; count: number; mine: boolean };

const column = (scope: ReactionScope) =>
  scope === "dm" ? "dm_message_id" : "community_message_id";

/** All reactions for a set of messages, grouped by message id. */
export function useReactions(scope: ReactionScope, scopeId: string | null, ids: string[]) {
  const key = ids.join(",");
  return useQuery({
    queryKey: ["reactions", scope, scopeId, key],
    enabled: ids.length > 0,
    refetchInterval: 6000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id ?? null;
      const { data, error } = await supabase
        .from("message_reactions")
        .select(`id, user_id, emoji, ${column(scope)}`)
        .in(column(scope), ids);
      if (error) throw error;
      const map: Record<string, ReactionTally[]> = {};
      for (const row of data ?? []) {
        const target = (row as Record<string, unknown>)[column(scope)] as string | null;
        if (!target) continue;
        const list = (map[target] ??= []);
        const existing = list.find((r) => r.emoji === row.emoji);
        if (existing) {
          existing.count += 1;
          if (row.user_id === me) existing.mine = true;
        } else {
          list.push({ emoji: row.emoji, count: 1, mine: row.user_id === me });
        }
      }
      return map;
    },
  });
}

export function useToggleReaction(scope: ReactionScope, scopeId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
      mine,
    }: {
      messageId: string;
      emoji: string;
      mine: boolean;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) throw new Error("Sign in first");
      if (mine) {
        const { error } = await supabase
          .from("message_reactions")
          .delete()
          .eq("user_id", me)
          .eq("emoji", emoji)
          .eq(column(scope), messageId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("message_reactions").insert({
        user_id: me,
        emoji,
        [column(scope)]: messageId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["reactions", scope, scopeId] });
    },
  });
}
