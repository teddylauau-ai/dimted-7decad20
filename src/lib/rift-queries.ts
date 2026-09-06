import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Server-held Nova Rift wallet + wardrobe, so it follows you across devices. */
export type RiftState = {
  runner: string;
  trail: string;
  starsSpent: number;
  starsEarned: number;
  starsAvailable: number;
  unlocks: string[];
};

const FALLBACK: RiftState = {
  runner: "aurora",
  trail: "ghost",
  starsSpent: 0,
  starsEarned: 0,
  starsAvailable: 0,
  unlocks: [],
};

type RawState = {
  runner?: string;
  trail?: string;
  stars_spent?: number;
  stars_earned?: number;
  stars_available?: number;
  unlocks?: string[];
};

export function useRiftState(userId: string | undefined) {
  return useQuery({
    queryKey: ["rift-state", userId],
    enabled: !!userId,
    queryFn: async (): Promise<RiftState> => {
      const { data, error } = await supabase.rpc("rift_state_for_me" as never);
      if (error) throw error;
      const raw = (data ?? {}) as RawState;
      return {
        runner: raw.runner ?? FALLBACK.runner,
        trail: raw.trail ?? FALLBACK.trail,
        starsSpent: raw.stars_spent ?? 0,
        starsEarned: raw.stars_earned ?? 0,
        starsAvailable: raw.stars_available ?? 0,
        unlocks: raw.unlocks ?? [],
      };
    },
  });
}

export type RiftItem = { slug: string; kind: "level" | "runner" | "trail"; name: string; cost_stars: number };

export function useRiftShop() {
  return useQuery({
    queryKey: ["rift-shop"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RiftItem[]> => {
      const { data, error } = await supabase
        .from("rift_items" as never)
        .select("slug, kind, name, cost_stars");
      if (error) throw error;
      return (data ?? []) as unknown as RiftItem[];
    },
  });
}

function useRiftInvalidate(userId: string | undefined) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["rift-state", userId] });
    void qc.invalidateQueries({ queryKey: ["campaign-progress", userId] });
    void qc.invalidateQueries({ queryKey: ["rift-leaderboard"] });
  };
}

export type BuyResult = { status: string; need?: number; have?: number };

export function useRiftBuy(userId: string | undefined) {
  const bust = useRiftInvalidate(userId);
  return useMutation({
    mutationFn: async (slug: string): Promise<BuyResult> => {
      const { data, error } = await supabase.rpc("rift_buy" as never, { _slug: slug } as never);
      if (error) throw error;
      return (data ?? { status: "error" }) as unknown as BuyResult;
    },
    onSuccess: bust,
  });
}

export function useRiftEquip(userId: string | undefined) {
  const bust = useRiftInvalidate(userId);
  return useMutation({
    mutationFn: async ({ kind, slug }: { kind: "runner" | "trail"; slug: string }) => {
      const { data, error } = await supabase.rpc("rift_equip" as never, {
        _kind: kind,
        _slug: slug,
      } as never);
      if (error) throw error;
      return data as unknown as { status: string };
    },
    onSuccess: bust,
  });
}

export const levelSlug = (n: number) => `level:${n}`;
