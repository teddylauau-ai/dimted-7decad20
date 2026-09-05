import { useMemo, useState } from "react";
import { CalendarCheck, Flame, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelHead, RarityChip } from "@/components/dimted/primitives";
import { cn } from "@/lib/utils";
import { useDimted } from "@/lib/dimted-store";
import {
  METRIC_LABEL,
  STREAK_CAP_DAY,
  claimDailyStreak,
  streakBaseXp,
  useAchievementProgress,
  useAchievements,
  useMyAchievements,
  useSyncAchievements,
} from "@/lib/achievements";

/** Daily streak claim + achievement tracker. Every number here is the real server payout. */
export function DailyBonus() {
  const { profile, totalXp, refreshProfile } = useDimted();
  const [claiming, setClaiming] = useState(false);

  const all = useAchievements().data ?? [];
  const claims = useMyAchievements(profile?.id).data ?? [];
  const progress = useAchievementProgress(profile?.id, totalXp).data ?? {};
  const claimed = useMemo(() => new Set(claims.map((c) => c.slug)), [claims]);

  const sync = useSyncAchievements((r) => {
    const earned = r.earned ?? [];
    if (!earned.length) {
      toast.info("No new achievements yet", { description: "Keep going — progress is tracked live." });
      return;
    }
    toast.success(`${earned.length} achievement${earned.length === 1 ? "" : "s"} unlocked`, {
      description: `${earned.map((e) => e.title).join(", ")} · +${(r.gained ?? 0).toLocaleString()} XP`,
    });
    void refreshProfile();
  });

  const today = new Date().toISOString().slice(0, 10);
  const streakDone = profile?.streak_claimed_on === today;
  const nextDay = streakDone ? (profile?.streak ?? 1) : profile?.streak_claimed_on
    ? isYesterday(profile.streak_claimed_on) ? (profile.streak ?? 0) + 1 : 1
    : 1;

  const ready = all.filter((a) => !claimed.has(a.slug) && (progress[a.metric] ?? 0) >= a.goal);
  const pending = all.filter((a) => !claimed.has(a.slug) && (progress[a.metric] ?? 0) < a.goal);

  async function claimStreak() {
    setClaiming(true);
    try {
      const r = await claimDailyStreak();
      if (r.status === "awarded") {
        toast.success(`Day ${r.streak} streak claimed`, {
          description: `+${(r.gained ?? 0).toLocaleString()} XP · +${(r.sparks_gained ?? 0).toLocaleString()} Sparks`,
        });
        await refreshProfile();
      } else if (r.status === "already_claimed") {
        toast.info("Already claimed today", { description: "Come back tomorrow to keep the streak." });
      } else {
        toast.error("Could not claim the streak right now.");
      }
    } catch {
      toast.error("Could not claim the streak right now.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <Panel className="p-4">
        <PanelHead
          eyebrow="Every day"
          title="Login streak"
          aside={<span className="text-muted-foreground font-mono text-[11px]">day {nextDay}</span>}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Claim once a day. Day 1 pays {streakBaseXp(1)} XP and each day in a row adds 40 more, up to{" "}
          {streakBaseXp(STREAK_CAP_DAY)} XP on day {STREAK_CAP_DAY}. Miss a day and it restarts at day 1. Level scaling
          and Surge apply on top.
        </p>

        <div className="mt-3 flex flex-wrap gap-1">
          {Array.from({ length: STREAK_CAP_DAY }, (_, i) => i + 1).map((d) => (
            <span
              key={d}
              title={`Day ${d} · ${streakBaseXp(d)} XP`}
              className={cn(
                "grid size-6 place-items-center rounded-md font-mono text-[10px]",
                d < nextDay || (streakDone && d <= nextDay)
                  ? "bg-primary/20 text-primary ring-primary/40 ring-1"
                  : "bg-secondary/40 text-muted-foreground",
              )}
            >
              {d}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={claimStreak} disabled={streakDone || claiming} className="gap-1.5">
            {streakDone ? <CalendarCheck className="size-3.5" /> : <Flame className="size-3.5" />}
            {streakDone ? "Claimed today" : `Claim ${streakBaseXp(nextDay).toLocaleString()} XP`}
          </Button>
          <span className="text-muted-foreground text-[11px]">
            Longest run so far: {(profile?.streak ?? 0).toLocaleString()} day
            {(profile?.streak ?? 0) === 1 ? "" : "s"}
          </span>
        </div>
      </Panel>

      <Panel className="p-4">
        <PanelHead
          eyebrow="One-time rewards"
          title="Achievements"
          aside={
            <span className="text-muted-foreground font-mono text-[11px]">
              {claims.length}/{all.length} done
            </span>
          }
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Milestones pay out once. Progress you already made counts, so anything you've passed can be claimed now.
        </p>

        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            variant={ready.length ? "default" : "secondary"}
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="gap-1.5"
          >
            <Trophy className="size-3.5" />
            {ready.length ? `Claim ${ready.length} ready` : "Check for new ones"}
          </Button>
          {ready.length > 0 && (
            <span className="text-primary text-[11px] font-medium">
              +{ready.reduce((n, a) => n + a.reward_xp, 0).toLocaleString()} XP waiting
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          {[...ready, ...pending].slice(0, 6).map((a) => {
            const have = progress[a.metric] ?? 0;
            const pct = Math.min(100, Math.round((have / a.goal) * 100));
            const done = have >= a.goal;
            return (
              <div key={a.slug} className={cn("rounded-xl p-2.5", done ? "bg-primary/10 ring-primary/25 ring-1" : "bg-secondary/20")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <RarityChip rarity={a.rarity as never} />
                    <span className="text-primary font-mono text-[10px]">+{a.reward_xp.toLocaleString()} XP</span>
                  </div>
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{a.blurb}</p>
                <div className="bg-secondary mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
                <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                  {Math.min(have, a.goal).toLocaleString()} / {a.goal.toLocaleString()} {METRIC_LABEL[a.metric] ?? a.metric}
                </p>
              </div>
            );
          })}
          {claims.length === all.length && all.length > 0 && (
            <p className="text-muted-foreground text-xs">Every achievement claimed. Nothing left to farm here.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

function isYesterday(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  const y = new Date();
  y.setUTCDate(y.getUTCDate() - 1);
  return d.toISOString().slice(0, 10) === y.toISOString().slice(0, 10);
}
