import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Meter, Panel, PanelHead, PageHeader, RarityChip, LockedTile } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import { ProfileLink } from "@/components/dimted/Identity";
import {
  CHALLENGES,
  SECRETS,
  UNLOCKS,
  XP_SOURCES,
  nextUnlock,
  rankForLevel,
} from "@/lib/dimted";
import { countEvents, useMyXpEvents, usePlayerStats, useXpFeed } from "@/lib/dimted-queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dimted — chat, level up, unlock a world" },
      {
        name: "description",
        content:
          "Your Dimted progression hub: level, XP, Energy Surge, daily and weekly challenges, and what unlocks next.",
      },
      { property: "og:title", content: "Dimted — your progression hub" },
      {
        property: "og:description",
        content: "Real conversations earn XP. XP raises your Level. Levels open the world.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { profile, level, rank, intoLevel, needed, progress, totalXp, energy, surgeActive, surgeSecondsLeft, igniteSurge } =
    useDimted();
  const stats = usePlayerStats(profile?.id, totalXp);
  const events = useMyXpEvents(profile?.id);
  const feed = useXpFeed(profile?.id);

  const upcoming = nextUnlock(level);
  const dailies = CHALLENGES.filter((c) => c.cadence === "daily");
  const weeklies = CHALLENGES.filter((c) => c.cadence === "weekly");
  const nextSecret = SECRETS.find((s) => s.requiredLevel > level);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Progression"
        title={`Level ${level} · ${rank}`}
        blurb={
          profile
            ? `Welcome back, ${profile.display_name}. Everything below moved because you talked to someone.`
            : undefined
        }
        aside={
          <div className="text-right">
            <p className="numeral text-3xl">{totalXp.toLocaleString()}</p>
            <p className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
              total xp
            </p>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel className="p-5">
          <PanelHead
            eyebrow="Your ladder"
            title={`${(needed - intoLevel).toLocaleString()} XP to Level ${level + 1}`}
            aside={`${intoLevel.toLocaleString()} / ${needed.toLocaleString()}`}
          />
          <Meter value={progress} tone="xp" className="mt-4 h-3" animate />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="border-border bg-background/40 rounded-xl border p-4">
              <p className="eyebrow">Next unlock</p>
              {upcoming ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="numeral text-gold text-xl">{upcoming.level}</span>
                    <RarityChip rarity={upcoming.rarity} />
                  </div>
                  <p className="mt-2 text-sm font-medium">{upcoming.name}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{upcoming.detail}</p>
                </>
              ) : (
                <p className="text-muted-foreground mt-2 text-sm">
                  You've passed every published unlock.
                </p>
              )}
            </div>

            <div
              className={
                surgeActive
                  ? "border-gold/40 bg-gold/10 rounded-xl border p-4"
                  : "border-border bg-background/40 rounded-xl border p-4"
              }
            >
              <p className="eyebrow">Energy</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="numeral text-xl">
                  {surgeActive
                    ? `${Math.floor(surgeSecondsLeft / 60)}:${String(surgeSecondsLeft % 60).padStart(2, "0")}`
                    : `${energy}%`}
                </span>
                <span className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
                  {surgeActive ? "surge live" : "charge"}
                </span>
              </div>
              <Meter
                value={surgeActive ? surgeSecondsLeft / 1800 : energy / 100}
                tone="energy"
                className="mt-3 h-1.5"
              />
              <Button
                size="sm"
                variant={surgeActive ? "outline" : "default"}
                className="mt-3 w-full"
                disabled={surgeActive || energy < 100}
                onClick={() => void igniteSurge()}
              >
                <Flame className="size-3.5" />
                {surgeActive ? "Surge running" : energy < 100 ? "Charging from chat" : "Ignite surge"}
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Friends", value: stats.friends },
              { label: "Communities", value: stats.communities },
              { label: "Arcade runs", value: stats.activities },
              { label: "Discoveries", value: stats.discoveries },
            ].map((s) => (
              <div key={s.label} className="border-border bg-background/40 rounded-xl border p-3">
                <p className="numeral text-xl">{s.value}</p>
                <p className="text-muted-foreground mt-0.5 font-mono text-[10px] tracking-[0.18em] uppercase">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5" delay={60}>
          <PanelHead eyebrow="Challenges" title="Today & this week" />
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
                Daily
              </p>
              <ul className="mt-2 space-y-2.5">
                {dailies.map((c) => {
                  const done = countEvents(events.data, c.source, "daily");
                  return (
                    <li key={c.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm">{c.title}</span>
                        <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                          {Math.min(done, c.goal)}/{c.goal}
                        </span>
                      </div>
                      <Meter value={Math.min(1, done / c.goal)} tone="gold" className="mt-1.5 h-1.5" />
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <p className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
                Weekly
              </p>
              <ul className="mt-2 space-y-2.5">
                {weeklies.map((c) => {
                  const done = countEvents(events.data, c.source, "weekly");
                  return (
                    <li key={c.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm">{c.title}</span>
                        <RarityChip rarity={c.rarity} />
                      </div>
                      <Meter value={Math.min(1, done / c.goal)} tone="primary" className="mt-1.5 h-1.5" />
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel className="p-5" delay={100}>
          <PanelHead
            eyebrow="Live"
            title="XP feed"
            aside={feed.data?.length ? `${feed.data.length} events` : undefined}
          />
          {feed.data && feed.data.length > 0 ? (
            <ul className="mt-4 space-y-2.5">
              {feed.data.slice(0, 10).map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm">
                    {e.user_id === profile?.id ? (
                      <span className="text-foreground/70">You</span>
                    ) : (
                      <ProfileLink profile={e.author} className="text-foreground/70 text-sm" />
                    )}{" "}
                    · {e.label ?? e.source}
                  </span>
                  <span className="text-primary shrink-0 font-mono text-[11px]">+{e.amount}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm">
              Nothing has happened yet. Start a conversation in{" "}
              <Link to="/messages" className="text-primary hover:underline">
                Messages
              </Link>{" "}
              and this fills up.
            </p>
          )}

          <div className="border-border mt-5 border-t pt-4">
            <p className="eyebrow">How XP works</p>
            <ul className="mt-2 space-y-1.5">
              {XP_SOURCES.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-foreground/85">{s.label}</span>
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    +{s.xp} · {s.cooldownLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel className="p-5" delay={140}>
          <PanelHead eyebrow="Ahead of you" title="Still hidden" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {nextSecret ? (
              <LockedTile hint={nextSecret.hint} requirement={`Level ${nextSecret.requiredLevel}`} />
            ) : null}
          </div>

          <ul className="mt-4 space-y-2">
            {UNLOCKS.filter((u) => u.level > level)
              .slice(0, 5)
              .map((u) => (
                <li
                  key={u.level}
                  className="border-border bg-background/40 flex items-center gap-3 rounded-xl border p-3"
                >
                  <span className="numeral text-muted-foreground w-8 shrink-0 text-lg">{u.level}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm">{u.name}</span>
                    <span className="text-muted-foreground block text-xs">{u.detail}</span>
                  </span>
                  <RarityChip rarity={u.rarity} />
                </li>
              ))}
          </ul>

          <p className="text-muted-foreground mt-4 flex items-start gap-2 text-xs">
            <Sparkles className="text-gold mt-0.5 size-3.5 shrink-0" />
            At Level {level + 1} you'll be a {rankForLevel(level + 1)}. Nothing here can be bought.
          </p>
        </Panel>
      </div>
    </div>
  );
}
