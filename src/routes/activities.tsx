import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Lock, Play, Users } from "lucide-react";
import { toast } from "sonner";
import { ACTIVITIES, CHALLENGES } from "@/lib/dimted";
import { useDimted } from "@/lib/dimted-store";
import { LockedTile, Meter, Panel, PanelHead, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/activities")({
  head: () => ({
    meta: [
      { title: "Activities — DIMTED" },
      {
        name: "description",
        content:
          "DIMTED-exclusive social activities: Quickdraw, Guess the Message, Chaos Questions, Hidden Object, Duo Quest and community-wide challenges.",
      },
      { property: "og:title", content: "Activities — DIMTED" },
      { property: "og:description", content: "Social games built around chatting, not generic board games." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivitiesPage,
});

const PROMPTS = [
  "a polite storm",
  "the last honest vending machine",
  "a library that only holds one book",
  "your friend, as a lighthouse",
  "a very small emergency",
];

function ActivitiesPage() {
  const { level, award } = useDimted();
  const [session, setSession] = useState<{ name: string; prompt: string } | null>(null);
  const weekly = CHALLENGES.filter((c) => c.cadence === "weekly").slice(0, 3);

  const start = (name: string, xp: number) => {
    const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)]!;
    setSession({ name, prompt });
    const r = award("activity", xp, name);
    if (r === "cooldown") toast("Give it a minute — activity XP is limited to four a day.");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Activities"
        title="Games that only make sense between people"
        blurb="No chess, no snake. Each one needs someone you actually talk to."
      />

      {session ? (
        <Panel className="border-primary/40 glow-primary p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">In session · {session.name}</p>
              <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight">“{session.prompt}”</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                30 seconds. Both of you get the same prompt. Neither of you gets more time.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setSession(null)}>
              End session
            </Button>
          </div>
          <Meter value={0.42} className="mt-5 h-2" tone="gold" animate />
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ACTIVITIES.map((a, i) => {
          const locked = a.requiredLevel != null && level < a.requiredLevel;
          return (
            <Panel key={a.id} delay={i * 50} className={cn("flex flex-col p-5", locked && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-base font-semibold tracking-tight">{a.name}</h2>
                <RarityChip rarity={a.rarity} />
              </div>
              <p className="text-muted-foreground mt-2 flex-1 text-sm">{a.blurb}</p>
              <div className="text-muted-foreground mt-4 flex items-center gap-4 font-mono text-[10px] tracking-wide uppercase">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3" /> {a.players}
                </span>
                {a.minutes ? (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3" /> {a.minutes} min
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-primary font-mono text-xs">+{a.rewardXp} XP</span>
                <Button size="sm" disabled={locked} onClick={() => start(a.name, a.rewardXp)}>
                  {locked ? (
                    <>
                      <Lock className="size-3.5" /> Level {a.requiredLevel}
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" /> Start
                    </>
                  )}
                </Button>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-6 xl:col-span-2" delay={200}>
          <PanelHead eyebrow="Weekly" title="Challenges tied to activities" />
          <div className="mt-4 space-y-3">
            {weekly.map((c) => (
              <div key={c.id} className="border-border bg-background/40 rounded-xl border p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm">{c.title}</p>
                  <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                    {c.progress.toLocaleString()}/{c.goal.toLocaleString()}
                  </span>
                </div>
                <Meter value={c.progress / c.goal} className="mt-3 h-1.5" tone="xp" />
                <p className="text-muted-foreground mt-2 font-mono text-[10px]">
                  +{c.rewardXp} XP{c.rewardItem ? ` · ${c.rewardItem}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6" delay={240}>
          <PanelHead eyebrow="Unannounced" title="Something else is here" />
          <div className="mt-4 space-y-3">
            <LockedTile hint="An activity with no name yet" requirement="Play with 10 different people" />
            <LockedTile hint="It only runs once a month" requirement="Unknown" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
