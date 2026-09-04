import { useQueryClient } from "@tanstack/react-query";
import { Check, Gift, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Meter, Panel, PanelHead, RarityChip } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import {
  countEvents,
  periodKeyFor,
  useMyXpEvents,
  useQuestClaims,
  useQuests,
} from "@/lib/dimted-queries";
import { claimQuest } from "@/lib/dimted-actions";
import { formatCountdown, secondsUntilDailyReset, secondsUntilWeeklyReset } from "@/lib/cosmetics";

/**
 * Quests that actually pay out. Progress is read from your real XP event log
 * and the reward is validated again on the server, so there is no way to claim
 * something you didn't do.
 */
export function QuestBoard() {
  const { profile, refreshProfile } = useDimted();
  const qc = useQueryClient();
  const quests = useQuests();
  const events = useMyXpEvents(profile?.id);
  const claims = useQuestClaims(profile?.id);
  const [busy, setBusy] = useState<string | null>(null);

  const claimed = new Set(
    (claims.data ?? []).map((c) => `${c.quest_slug}:${c.period_key}`),
  );

  const claim = async (slug: string) => {
    setBusy(slug);
    const res = await claimQuest(slug);
    setBusy(null);
    if (res.status === "claimed_now") {
      toast.success(`Quest complete · +${res.reward_xp} XP`, {
        description: res.reward_sparks ? `+${res.reward_sparks} sparks` : undefined,
      });
      await refreshProfile();
      void qc.invalidateQueries({ queryKey: ["quest-claims"] });
      void qc.invalidateQueries({ queryKey: ["my-xp-events"] });
    } else if (res.status === "incomplete") {
      toast.error("Not finished yet", {
        description: `You're at ${res.progress ?? 0} of ${res.goal ?? 0}.`,
      });
    } else if (res.status === "claimed") {
      toast.info("Already claimed this one.");
      void qc.invalidateQueries({ queryKey: ["quest-claims"] });
    } else {
      toast.error("Couldn't claim that quest.");
    }
  };

  const render = (cadence: "daily" | "weekly") => {
    const list = (quests.data ?? []).filter((q) => q.cadence === cadence);
    const period = periodKeyFor(cadence);
    const resets =
      cadence === "daily"
        ? formatCountdown(secondsUntilDailyReset())
        : formatCountdown(secondsUntilWeeklyReset());

    return (
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
            {cadence}
          </p>
          <p className="text-muted-foreground/70 font-mono text-[10px]">resets in {resets}</p>
        </div>
        <ul className="mt-1 space-y-2">
          {list.map((q) => {
            const done = countEvents(events.data, q.source, cadence);
            const complete = done >= q.goal;
            const already = claimed.has(`${q.slug}:${period}`);
            return (
              <li key={q.slug}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">{q.title}</span>
                  <RarityChip rarity={q.rarity} />
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <Meter
                    value={Math.min(1, done / q.goal)}
                    tone={cadence === "daily" ? "gold" : "primary"}
                    className="h-1.5 flex-1"
                  />
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {Math.min(done, q.goal)}/{q.goal}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground font-mono text-[10px]">
                    +{q.reward_xp} XP · +{q.reward_sparks} ✦
                  </span>
                  {already ? (
                    <span className="text-uncommon flex items-center gap-1 font-mono text-[10px]">
                      <Check className="size-3" /> claimed
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant={complete ? "default" : "outline"}
                      disabled={!complete || busy === q.slug}
                      onClick={() => void claim(q.slug)}
                      className="h-6 px-2 text-[11px]"
                    >
                      {busy === q.slug ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Gift className="size-3" />
                      )}
                      Claim
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <Panel className="p-3" delay={60}>
      <PanelHead eyebrow="Quests" title="Today & this week" />
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {render("daily")}
        {render("weekly")}
      </div>
    </Panel>
  );
}
