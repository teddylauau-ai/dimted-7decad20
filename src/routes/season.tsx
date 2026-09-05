import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Gift, Lock } from "lucide-react";
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
import { Avatar, Nametag } from "@/components/dimted/Identity";
import { bannerFor, EFFECT_CLASS } from "@/lib/cosmetics";
import type { Cosmetic } from "@/lib/cosmetics";
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

function RewardPreview({ cosmetic }: { cosmetic: Cosmetic }) {
  const { profile } = useDimted();
  const base = {
    username: "",
    display_name: profile?.display_name ?? "You",
    equipped_nametag: cosmetic.slot === "nametag" ? cosmetic.slug : null,
    equipped_badge: cosmetic.slot === "badge" ? cosmetic.slug : null,
    equipped_frame: cosmetic.slot === "frame" ? cosmetic.slug : null,
  };

  if (cosmetic.slot === "banner") {
    return (
      <div
        className="h-16 w-full rounded-lg border border-border/60"
        style={{ background: bannerFor(cosmetic.slug) }}
        aria-label={`${cosmetic.name} banner preview`}
      />
    );
  }

  if (cosmetic.slot === "effect") {
    return (
      <div className="bg-background/50 rounded-lg px-2 py-2">
        <div className={cn("flex items-center gap-2", EFFECT_CLASS[cosmetic.slug])}>
          <Avatar profile={base} size={24} presence={false} />
          <span className="text-xs">Your messages arrive like this</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background/50 flex items-center gap-2 rounded-lg px-2 py-2">
      <Avatar profile={base} size={34} presence={false} />
      <Nametag profile={base} className="text-sm" />
      <span className="text-muted-foreground ml-auto text-[10px] capitalize">{cosmetic.slot}</span>
    </div>
  );
}

function TitlePreview({ label }: { label: string }) {
  const { profile } = useDimted();
  return (
    <div className="bg-background/50 flex items-center gap-2 rounded-lg px-2 py-2">
      <Avatar profile={{ username: "", display_name: profile?.display_name ?? "You" }} size={34} presence={false} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{profile?.display_name ?? "You"}</p>
        <p className="text-legendary truncate text-[11px] font-semibold tracking-wide uppercase">{label}</p>
      </div>
    </div>
  );
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

  const claimable = useMemo(
    () => (tiers.data ?? []).filter((t) => tier >= t.tier && !claimed.includes(t.tier)).map((t) => t.tier),
    [tiers.data, tier, claimed],
  );
  const [claimingAll, setClaimingAll] = useState(false);

  async function claimAll() {
    if (!season.data || claimable.length === 0) return;
    setClaimingAll(true);
    let ok = 0;
    try {
      for (const t of claimable) {
        try {
          const res = await claimTier(season.data.id, t);
          if (res.ok) ok += 1;
        } catch {
          /* keep going through the rest */
        }
      }
      await progress.refetch();
      await tiers.refetch();
      if (ok > 0) toast.success(`Claimed ${ok} tier${ok === 1 ? "" : "s"}`);
      else toast.error("Nothing could be claimed right now");
    } finally {
      setClaimingAll(false);
    }
  }

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
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-muted-foreground font-mono text-xs">Next tier</p>
              <p className="font-display text-lg font-semibold">{tierXpNeeded(tier + 1).toLocaleString()} XP</p>
            </div>
            <Button
              size="sm"
              onClick={claimAll}
              disabled={claimable.length === 0 || claimingAll}
              className="gap-1.5"
            >
              <Gift className="size-4" />
              {claimingAll
                ? "Claiming…"
                : claimable.length > 0
                  ? `Claim all (${claimable.length})`
                  : "Nothing to claim"}
            </Button>
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
          const isFinal = t.tier === 50;
          const big = t.reward_type === "cosmetic" || t.reward_type === "title";
          const rarity = t.cosmetic?.rarity ?? (t.reward_type === "title" ? "legendary" : null);
          return (
            <div
              key={t.id}
              className={cn(
                "glass relative overflow-hidden rounded-2xl p-4 transition",
                unlocked ? "opacity-100" : "opacity-70",
                big && rarity ? cn("border", rarityBorder[rarity]) : null,
                isFinal ? "sm:col-span-2 lg:col-span-3" : null,
              )}
            >
              {big && rarity ? (
                <div className={cn("pointer-events-none absolute inset-0 opacity-40", rarityBg[rarity])} />
              ) : null}
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">{isFinal ? "Final reward" : `Tier ${t.tier}`}</p>
                  <p className="font-display text-2xl font-bold">
                    {t.reward_type === "cosmetic" && t.cosmetic
                      ? t.cosmetic.name
                      : t.reward_type === "title"
                        ? (t.title?.label ?? "Season Title")
                        : t.reward_type === "sparks"
                          ? `${t.reward_value.toLocaleString()} Sparks`
                          : t.reward_type === "xp"
                            ? `${t.reward_value.toLocaleString()} XP`
                            : "Bonus"}
                  </p>
                  {rarity ? (
                    <p className={cn("text-[11px] font-semibold capitalize", rarityText[rarity])}>
                      {rarity} {t.reward_type === "title" ? "title" : (t.cosmetic?.slot ?? "")}
                    </p>
                  ) : null}
                </div>
                {isClaimed ? (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-green-500/20 text-green-400">
                    <Check className="size-4" />
                  </span>
                ) : unlocked ? (
                  <Button size="sm" onClick={() => claim(t.tier)}>Claim</Button>
                ) : (
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-[11px]">
                    <Lock className="size-3.5" />
                    Tier {t.tier}
                  </span>
                )}
              </div>

              <div className="relative mt-3">
                {t.reward_type === "cosmetic" && t.cosmetic ? (
                  <RewardPreview cosmetic={t.cosmetic} />
                ) : t.reward_type === "title" && t.title ? (
                  <TitlePreview label={t.title.label} />
                ) : t.reward_type === "sparks" ? (
                  <p className="text-muted-foreground text-xs">Spend Sparks in the Shop on cosmetics.</p>
                ) : t.reward_type === "xp" ? (
                  <p className="text-muted-foreground text-xs">Counts straight towards your account level.</p>
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
