import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import {
  claimTier,
  currentTier,
  fetchActiveSeason,
  fetchMySeasonProgress,
  fetchSeasonTiers,
  seasonTimeLeft,
  tierXpNeeded,
} from "@/lib/season";
import { useEffect, useMemo, useState } from "react";
import { rarityBorder, rarityText, rarityBg } from "@/components/dimted/rarity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/season")({
  head: () => ({
    meta: [
      { title: "Season Pass — Lazu" },
      {
        name: "description",
        content: "Earn XP, climb 50 free tiers, and unlock season-exclusive cosmetics.",
      },
      { property: "og:title", content: "Season Pass — Lazu" },
      { property: "og:description", content: "Free monthly rewards for playing." },
    ],
  }),
  component: SeasonPage,
});

function fmtTime(totalSeconds: number) {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function SeasonPage() {
  const { profile } = useDimted();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const season = useQuery({
    queryKey: ["active-season"],
    queryFn: fetchActiveSeason,
    refetchInterval: 30000,
  });

  const tiers = useQuery({
    queryKey: ["season-tiers", season.data?.id],
    enabled: !!season.data?.id,
    queryFn: () => fetchSeasonTiers(season.data!.id),
    refetchInterval: 30000,
  });

  const progress = useQuery({
    queryKey: ["season-progress", season.data?.id, profile?.id],
    enabled: !!season.data?.id && !!profile?.id,
    queryFn: () => fetchMySeasonProgress(season.data!.id),
    refetchInterval: 5000,
  });

  const xp = progress.data?.xp ?? 0;
  const claimed = progress.data?.claimed_tiers ?? [];
  const tier = currentTier(xp);

  const timeLeft = useMemo(() => {
    if (!season.data?.ends_at) return 0;
    return seasonTimeLeft(season.data.ends_at);
  }, [season.data?.ends_at, now]);

  async function claim(tierNum: number) {
    if (!season.data) return;
    try {
      const res = await claimTier(season.data.id, tierNum);
      if (!res.ok) throw new Error(res.error || "Claim failed");
      await progress.refetch();
      await tiers.refetch();
      toast.success(`Tier ${tierNum} claimed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't claim tier");
    }
  }

  if (!season.data) {
    return (
      <div className="grid h-[60vh] place-items-center">
        <p className="text-muted-foreground">No active season right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Season Pass" title={season.data.name} blurb={`Resets in ${fmtTime(timeLeft)}`} />

      <Panel className="p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Your progress</p>
            <p className="font-display mt-1 text-3xl font-bold">Tier {tier}</p>
            <p className="text-muted-foreground text-sm">{xp.toLocaleString()} season XP</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground font-mono text-xs">Next tier</p>
            <p className="font-display text-lg font-semibold">{tierXpNeeded(tier + 1).toLocaleString()} XP</p>
          </div>
        </div>
        <div className="bg-secondary mt-3 h-3 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-gold"
            style={{ width: `${Math.min(100, (xp / tierXpNeeded(tier + 1)) * 100)}%` }}
          />
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(tiers.data ?? []).map((t) => {
          const unlocked = tier >= t.tier;
          const isClaimed = claimed.includes(t.tier);
          return (
            <div
              key={t.id}
              className={cn(
                "glass relative overflow-hidden rounded-2xl p-4 transition",
                unlocked ? "opacity-100" : "opacity-60"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl font-bold">{t.tier}</p>
                  <p className="text-muted-foreground text-xs">{t.reward_type === "none" ? "Bonus" : t.reward_type}</p>
                </div>
                {isClaimed ? (
                  <span className="grid size-7 place-items-center rounded-full bg-green-500/20 text-green-400">
                    <Check className="size-4" />
                  </span>
                ) : unlocked ? (
                  <Button size="sm" onClick={() => claim(t.tier)}>Claim</Button>
                ) : (
                  <span className="grid size-7 place-items-center rounded-full bg-secondary text-muted-foreground">
                    <Lock className="size-3.5" />
                  </span>
                )}
              </div>

              <div className="mt-3">
                {t.reward_type === "cosmetic" && t.cosmetic ? (
                  <div className={cn("rounded-xl border p-3", rarityBorder[t.cosmetic.rarity], rarityBg[t.cosmetic.rarity])}>
                    <p className={cn("font-semibold", rarityText[t.cosmetic.rarity])}>{t.cosmetic.name}</p>
                    <p className="text-muted-foreground text-[10px] capitalize">{t.cosmetic.slot}</p>
                  </div>
                ) : t.reward_type === "title" ? (
                  <div className="rounded-xl border border-gold/30 bg-gold/10 p-3">
                    <p className="text-gold font-semibold">Season Title</p>
                  </div>
                ) : t.reward_type === "sparks" ? (
                  <p className="font-display text-xl font-semibold text-primary">{t.reward_value.toLocaleString()} Sparks</p>
                ) : t.reward_type === "xp" ? (
                  <p className="font-display text-xl font-semibold text-xp">{t.reward_value.toLocaleString()} XP</p>
                ) : (
                  <p className="text-muted-foreground text-sm italic">Just a celebration.</p>
                )}
                {t.description ? <p className="text-muted-foreground mt-1 text-xs">{t.description}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
