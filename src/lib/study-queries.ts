import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StudyRow = { deck: string; best_percent: number; attempts: number };

/** Your best result on each revision deck. */
export function useStudyProgress(userId: string | undefined) {
  return useQuery({
    queryKey: ["study-progress", userId],
    enabled: !!userId,
    queryFn: async (): Promise<StudyRow[]> => {
      const { data, error } = await supabase
        .from("study_progress")
        .select("deck, best_percent, attempts")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as StudyRow[];
    },
  });
}

export function useSaveAttempt(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ deck, percent }: { deck: string; percent: number }) => {
      if (!userId) throw new Error("Sign in to save progress");
      const { data: existing } = await supabase
        .from("study_progress")
        .select("id, best_percent, attempts")
        .eq("user_id", userId)
        .eq("deck", deck)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("study_progress")
          .update({
            best_percent: Math.max(existing.best_percent ?? 0, percent),
            attempts: (existing.attempts ?? 0) + 1,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("study_progress")
          .insert({ user_id: userId, deck, best_percent: percent, attempts: 1 });
        if (error) throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["study-progress", userId] }),
  });
}

export function bestFor(rows: StudyRow[] | undefined, deck: string): number {
  return (rows ?? []).find((r) => r.deck === deck)?.best_percent ?? 0;
}

export function masteredCount(rows: StudyRow[] | undefined): number {
  return (rows ?? []).filter((r) => (r.best_percent ?? 0) >= 80).length;
}
