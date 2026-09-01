import { createFileRoute } from "@tanstack/react-router";
import { Compass, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { COMMUNITIES, DISCOVER_REALMS, EVENTS, FRIENDS, SECRETS, friendshipLevel } from "@/lib/dimted";
import { useDimted } from "@/lib/dimted-store";
import { LockedTile, Meter, Panel, PanelHead, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { rarityText } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — DIMTED" },
      {
        name: "description",
        content:
          "Explore DIMTED: communities, people, Realms, limited-time events and challenges. Discovery earns XP and opens areas you weren't told about.",
      },
      { property: "og:title", content: "Discover — DIMTED" },
      { property: "og:description", content: "Wander the world: communities, Realms, events and secrets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { award } = useDimted();
  const suggested = FRIENDS.slice(2);

  const discover = (label: string) => {
    const r = award("discovery", 80, label);
    if (r === "granted") toast(`Discovered ${label}. Logged in your exploration record.`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Discover"
        title="Wander until something opens"
        blurb="Discovery is a progression source of its own. Finding a place counts; being sent there counts less."
        aside={
          <span className="glass text-muted-foreground flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px]">
            <Compass className="size-3.5" /> 12 of 40 areas found
          </span>
        }
      />

      {/* Events */}
      <Panel className="p-6">
        <PanelHead
          eyebrow="Limited time"
          title="DIMTED events"
          aside={
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> return when you want
            </span>
          }
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {EVENTS.map((e) => (
            <div key={e.id} className="border-border bg-background/40 flex flex-col rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-sm font-semibold tracking-tight">{e.name}</h3>
                <RarityChip rarity={e.rarity} />
              </div>
              <p className={`mt-2 font-mono text-[10px] tracking-[0.16em] uppercase ${rarityText[e.rarity]}`}>
                {e.status}
              </p>
              <p className="text-muted-foreground mt-2 flex-1 text-xs">{e.blurb}</p>
              <p className="text-muted-foreground/70 mt-3 font-mono text-[10px]">Ends {e.ends}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Communities */}
        <Panel className="p-6 xl:col-span-2" delay={80}>
          <PanelHead
            eyebrow="Trending"
            title="Communities you haven't touched"
            aside={
              <span className="flex items-center gap-1.5">
                <TrendingUp className="size-3.5" /> by real activity
              </span>
            }
          />
          <div className="mt-4 space-y-3">
            {COMMUNITIES.map((c) => (
              <div
                key={c.id}
                className="border-border bg-background/40 hover:border-primary/30 flex flex-wrap items-center gap-4 rounded-xl border p-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <span className="text-muted-foreground font-mono text-[10px]">Lv {c.level}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">{c.tagline}</p>
                  <Meter value={c.xpInto / c.xpNeeded} className="mt-2 h-1" tone="primary" />
                </div>
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  {c.online} online · {c.members.toLocaleString()} members
                </span>
                <Button size="sm" variant="secondary" onClick={() => discover(c.name)}>
                  Look inside
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        {/* People */}
        <Panel className="p-6" delay={120}>
          <PanelHead eyebrow="People" title="Might actually suit you" />
          <ul className="mt-4 space-y-3">
            {suggested.map((f) => {
              const b = friendshipLevel(f.friendshipXp);
              return (
                <li key={f.id} className="border-border bg-background/40 rounded-xl border p-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-secondary numeral grid size-9 shrink-0 place-items-center rounded-xl text-sm">
                      {f.name[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{f.name}</p>
                      <p className="text-muted-foreground truncate font-mono text-[10px]">
                        Lv {f.level} · {f.title}
                      </p>
                    </div>
                    <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px]">FL {b.level}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-6 xl:col-span-2" delay={160}>
          <PanelHead eyebrow="Realms" title="Open for visitors" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {DISCOVER_REALMS.map((r) => (
              <div key={r.id} className="border-border bg-background/40 overflow-hidden rounded-2xl border">
                <div
                  className="animate-drift h-28"
                  style={{
                    background:
                      "radial-gradient(80% 70% at 50% 120%, oklch(0.42 0.09 200 / 0.6), transparent 72%), linear-gradient(180deg, oklch(0.22 0.045 262), oklch(0.15 0.03 258))",
                  }}
                />
                <div className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm">{r.name}</p>
                    <RarityChip rarity={r.rarity} />
                  </div>
                  <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                    {r.owner} · Lv {r.level} · {r.visitors} visits
                  </p>
                  <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => discover(r.name)}>
                    Visit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6" delay={200}>
          <PanelHead eyebrow="Rumoured" title="Not on any map" />
          <div className="mt-4 space-y-3">
            {SECRETS.map((s) =>
              s.unlocked ? (
                <div key={s.id} className="border-uncommon/30 bg-uncommon/[0.07] rounded-xl border p-4">
                  <p className="font-display text-sm font-semibold">{s.hint}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{s.revealed}</p>
                </div>
              ) : (
                <LockedTile key={s.id} hint={s.hint} requirement={s.requirement} />
              ),
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
