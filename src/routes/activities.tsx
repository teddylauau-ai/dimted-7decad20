import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Meter, Panel, PanelHead, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import { ACTIVITIES, CHALLENGES } from "@/lib/dimted";
import {
  countEvents,
  useFriendships,
  useMyXpEvents,
  useRefreshDimted,
} from "@/lib/dimted-queries";

export const Route = createFileRoute("/activities")({
  head: () => ({
    meta: [
      { title: "Activities — Dimted" },
      {
        name: "description",
        content:
          "Dimted-exclusive social activities built around chatting with real friends — Quickdraw, Chaos Questions, Duo Quest and more.",
      },
      { property: "og:title", content: "Activities — Dimted" },
      { property: "og:description", content: "Social activities, not arcade games." },
    ],
  }),
  component: ActivitiesPage,
});

function ActivitiesPage() {
  const { profile, level, award, surgeActive } = useDimted();
  const friends = useFriendships(profile?.id);
  const events = useMyXpEvents(profile?.id);
  const refresh = useRefreshDimted();

  const hasFriends = (friends.data ?? []).some((f) => f.status === "accepted");

  async function play(name: string) {
    const result = await award("activity", name);
    if (result === "granted") {
      toast.success(`${name} finished${surgeActive ? " — double XP from your surge" : ""}.`);
      refresh();
      return;
    }
    if (result === "capped") toast("You've hit today's activity XP cap. Play for fun instead.");
    else if (result === "cooldown") toast("Give it a minute before the next one.");
    else toast.error("Couldn't record that");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Play"
        title="Activities"
        blurb="Every activity here needs another person. None of them exist outside Dimted."
      />

      {!hasFriends ? (
        <Panel className="border-primary/25 p-5">
          <p className="text-sm">
            Activities are social by design — you need at least one real friend before they mean
            anything.{" "}
            <Link to="/discover" className="text-primary hover:underline">
              Find someone first.
            </Link>
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ACTIVITIES.map((a, i) => {
          const locked = (a.requiredLevel ?? 1) > level;
          return (
            <Panel key={a.id} className="flex flex-col p-5" delay={i * 40}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base font-semibold tracking-tight">{a.name}</h3>
                <RarityChip rarity={a.rarity} />
              </div>
              <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">{a.blurb}</p>

              <div className="text-muted-foreground mt-4 flex items-center gap-4 font-mono text-[11px]">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" /> {a.players}
                </span>
                {a.minutes > 0 ? (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> {a.minutes}m
                  </span>
                ) : null}
                <span className="text-primary ml-auto">+{a.rewardXp} XP</span>
              </div>

              <Button
                className="mt-4 w-full"
                variant={locked ? "outline" : "default"}
                disabled={locked || !hasFriends}
                onClick={() => void play(a.name)}
              >
                {locked ? (
                  <>
                    <Lock className="size-3.5" /> Level {a.requiredLevel}
                  </>
                ) : (
                  "Start"
                )}
              </Button>
            </Panel>
          );
        })}
      </div>

      <Panel className="p-5">
        <PanelHead eyebrow="Challenges" title="Progress from real play" />
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {CHALLENGES.map((c) => {
            const done = countEvents(events.data, c.source, c.cadence);
            return (
              <li key={c.id} className="border-border bg-background/40 rounded-xl border p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm">{c.title}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {Math.min(done, c.goal)}/{c.goal}
                  </span>
                </div>
                <Meter
                  value={Math.min(1, done / c.goal)}
                  tone={c.cadence === "daily" ? "gold" : "primary"}
                  className="mt-2 h-1.5"
                />
                <p className="text-muted-foreground mt-2 flex items-center justify-between font-mono text-[10px]">
                  <span>{c.cadence}</span>
                  <span className="text-gold">+{c.rewardXp} XP</span>
                </p>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
