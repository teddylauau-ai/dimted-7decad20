import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Flame, Zap } from "lucide-react";
import { toast } from "sonner";
import { useDimted } from "@/lib/dimted-store";
import {
  CHALLENGES,
  FEED,
  REALM_OBJECTS,
  SECRETS,
  XP_SOURCES,
  nextUnlock,
  rankForLevel,
} from "@/lib/dimted";
import { LockedTile, Meter, Panel, PanelHead, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { rarityDot, rarityText } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DIMTED — chat that levels up with you" },
      {
        name: "description",
        content:
          "DIMTED is a social world where messages, friendships and communities feed one connected progression system. Earn XP, unlock your Realm, and explore together.",
      },
      { property: "og:title", content: "DIMTED — chat that levels up with you" },
      {
        property: "og:description",
        content: "A futuristic social platform where chatting is the game. XP, Realms, friendship levels and secrets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { level, rank, intoLevel, needed, progress, energy, surgeActive, surgeSecondsLeft, igniteSurge, award } =
    useDimted();
  const upcoming = nextUnlock(level);
  const daily = CHALLENGES.filter((c) => c.cadence === "daily");
  const weekly = CHALLENGES.filter((c) => c.cadence === "weekly");
  const placed = REALM_OBJECTS.filter((o) => o.owned);

  const claim = (id: string, xp: number, title: string) => {
    const result = award(id, xp, title);
    if (result === "cooldown") toast("On cooldown — DIMTED rewards real activity, not volume.");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Home · Your world"
        title="Something in your Realm moved last night."
        blurb="Everything you do here — messages, communities, activities — feeds one progression. No grind required."
        aside={
          <div className="text-muted-foreground flex items-center gap-2 font-mono text-[11px]">
            <span className="glass rounded-full px-3 py-1.5">Streak · 6 days</span>
            <span className="glass rounded-full px-3 py-1.5">3 friends online</span>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Level card */}
        <Panel className="p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="eyebrow">DIMTED World · current rank</p>
              <div className="mt-2 flex items-end gap-4">
                <span className="numeral text-glow text-6xl leading-none">{level}</span>
                <span className="border-primary/30 bg-primary/10 text-primary mb-2 rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.18em] uppercase">
                  {rank}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground font-mono text-sm">
                <span className="text-primary">{intoLevel.toLocaleString()}</span> / {needed.toLocaleString()} XP
              </p>
              <p className="text-muted-foreground/70 mt-1 font-mono text-[11px]">
                {(needed - intoLevel).toLocaleString()} to Level {level + 1} · {rankForLevel(level + 1)}
              </p>
            </div>
          </div>

          <Meter value={progress} tone="xp" className="mt-6 h-3" animate />
          <div className="text-muted-foreground mt-3 flex justify-between font-mono text-[11px]">
            <span>Level {level}</span>
            {upcoming ? (
              <span>
                Lv {upcoming.level} · {upcoming.name}
              </span>
            ) : null}
          </div>

          {upcoming ? (
            <div className="border-border bg-background/40 mt-5 flex items-center gap-4 rounded-2xl border p-4">
              <span className="bg-secondary numeral text-primary grid size-11 shrink-0 place-items-center rounded-xl">
                {upcoming.level}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-display truncate text-sm font-semibold">{upcoming.name}</p>
                  <RarityChip rarity={upcoming.rarity} />
                </div>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{upcoming.detail}</p>
              </div>
            </div>
          ) : null}
        </Panel>

        {/* Energy */}
        <Panel className={surgeActive ? "border-gold/40 glow-gold p-6" : "p-6"} delay={60}>
          <div className="flex items-center justify-between">
            <p className="eyebrow">Energy</p>
            {surgeActive ? (
              <span className="text-gold flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase">
                <span className="bg-gold size-1.5 rounded-full" /> Surge
              </span>
            ) : null}
          </div>
          <p className="font-display mt-3 text-xl leading-tight font-semibold">
            {surgeActive ? "Double XP for the next stretch" : "Momentum builds as you talk"}
          </p>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Conversations, community time, activities and challenges all raise Energy. Nothing here is buyable.
          </p>

          <Meter value={surgeActive ? surgeSecondsLeft / 1800 : energy / 100} tone="energy" className="mt-5 h-2.5" />
          <p className="text-muted-foreground mt-2 font-mono text-[11px]">
            {surgeActive
              ? `${Math.floor(surgeSecondsLeft / 60)}m ${surgeSecondsLeft % 60}s remaining`
              : `${energy} / 100`}
          </p>

          <Button
            variant={energy >= 100 ? "default" : "secondary"}
            className="mt-5 w-full"
            disabled={surgeActive || energy < 100}
            onClick={igniteSurge}
          >
            <Zap className="size-4" />
            {surgeActive ? "Surge running" : energy >= 100 ? "Ignite Energy Surge" : "Charging"}
          </Button>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Challenges */}
        <Panel className="p-6 xl:col-span-2" delay={100}>
          <PanelHead
            eyebrow="Rotating"
            title="Challenges"
            aside={`${daily.filter((c) => c.progress >= c.goal).length}/${daily.length} daily complete`}
          />
          <div className="mt-5 space-y-3">
            {daily.map((c) => {
              const done = c.progress >= c.goal;
              return (
                <div
                  key={c.id}
                  className="border-border bg-background/40 hover:border-primary/30 flex items-center gap-4 rounded-xl border p-3.5 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">Daily</p>
                    <p className="mt-1 truncate text-sm">{c.title}</p>
                  </div>
                  <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                    {c.progress}/{c.goal}
                  </span>
                  {done ? (
                    <span className="text-uncommon border-uncommon/30 bg-uncommon/10 shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px]">
                      +{c.rewardXp} claimed
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => claim("challenge", c.rewardXp, c.title)}>
                      Claim +{c.rewardXp}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-border mt-5 border-t pt-4">
            <p className="eyebrow">This week</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {weekly.map((c) => (
                <div key={c.id} className="border-border bg-background/30 rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm">{c.title}</p>
                    <RarityChip rarity={c.rarity} />
                  </div>
                  <Meter value={c.progress / c.goal} className="mt-3 h-1.5" tone="primary" />
                  <p className="text-muted-foreground mt-2 font-mono text-[10px]">
                    {c.progress.toLocaleString()}/{c.goal.toLocaleString()} · +{c.rewardXp} XP
                    {c.rewardItem ? ` · ${c.rewardItem}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Feed */}
        <Panel className="p-6" delay={140}>
          <PanelHead
            eyebrow="Live"
            title="Around DIMTED"
            aside={
              <span className="text-uncommon flex items-center gap-1.5">
                <span className="bg-uncommon size-1.5 rounded-full" /> now
              </span>
            }
          />
          <ul className="mt-4 space-y-1">
            {FEED.map((e) => (
              <li key={e.id} className="hover:bg-secondary/40 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors">
                <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${rarityDot[e.tone]}`} />
                <p className="text-muted-foreground min-w-0 flex-1 text-sm">
                  <span className="text-foreground">{e.who}</span> {e.what}{" "}
                  {e.highlight ? <span className={rarityText[e.tone]}>{e.highlight}</span> : null}
                </p>
                <span className="text-muted-foreground/60 shrink-0 font-mono text-[10px]">{e.when}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Realm preview */}
        <Panel className="overflow-hidden xl:col-span-2" delay={160}>
          <div className="flex items-end justify-between gap-4 p-6 pb-4">
            <PanelHead eyebrow="Your Realm" title="The Quiet Shore" />
            <Button variant="secondary" size="sm" asChild>
              <Link to="/realm">
                Enter <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
          <div className="relative mx-6 mb-6 h-56 overflow-hidden rounded-2xl border border-border">
            <div
              className="animate-drift absolute inset-0"
              style={{
                background:
                  "radial-gradient(80% 60% at 50% 110%, oklch(0.4 0.09 200 / 0.55), transparent 70%), radial-gradient(40% 40% at 78% 22%, oklch(0.5 0.11 82 / 0.35), transparent 70%), linear-gradient(180deg, oklch(0.19 0.04 262), oklch(0.14 0.03 258))",
              }}
            />
            {placed.map((o) => (
              <span
                key={o.id}
                title={`${o.name} — ${o.note}`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${rarityDot[o.rarity]} opacity-80`}
                style={{ left: `${o.x}%`, top: `${o.y}%`, width: o.size / 5, height: o.size / 5 }}
              />
            ))}
            <div className="absolute inset-x-0 bottom-0 flex justify-between p-4 font-mono text-[11px]">
              <span className="text-muted-foreground">{placed.length} objects placed</span>
              <span className="text-secret">2 sealed</span>
            </div>
          </div>
        </Panel>

        {/* Secrets */}
        <Panel className="p-6" delay={200}>
          <PanelHead eyebrow="Unexplained" title="Waiting to be found" />
          <div className="mt-4 space-y-3">
            {SECRETS.filter((s) => !s.unlocked)
              .slice(0, 3)
              .map((s) => (
                <LockedTile key={s.id} hint={s.hint} requirement={s.requirement} />
              ))}
          </div>
        </Panel>
      </div>

      {/* XP rules — anti-spam transparency */}
      <Panel className="p-6" delay={240}>
        <PanelHead
          eyebrow="How XP works"
          title="Rewarded for interaction, not volume"
          aside={
            <span className="flex items-center gap-1.5">
              <Flame className="size-3.5" /> cooldowns on everything
            </span>
          }
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {XP_SOURCES.map((s) => (
            <div key={s.id} className="border-border bg-background/30 rounded-xl border p-3.5">
              <div className="flex items-baseline justify-between">
                <p className="text-sm">{s.label}</p>
                <span className="text-primary font-mono text-xs">+{s.xp}</span>
              </div>
              <p className="text-muted-foreground/80 mt-2 font-mono text-[10px] tracking-wide uppercase">
                {s.cooldownLabel}
              </p>
              <p className="text-muted-foreground mt-1.5 text-xs">{s.note}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
