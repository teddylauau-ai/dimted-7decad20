import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Hash, Radio, Users } from "lucide-react";
import { toast } from "sonner";
import { COMMUNITIES } from "@/lib/dimted";
import { useDimted } from "@/lib/dimted-store";
import { LockedTile, Meter, Panel, PanelHead, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { rarityText } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/communities")({
  head: () => ({
    meta: [
      { title: "Communities — DIMTED" },
      {
        name: "description",
        content:
          "Communities in DIMTED level up too. Active members, events and shared challenges unlock layouts, banners and larger community spaces.",
      },
      { property: "og:title", content: "Communities — DIMTED" },
      { property: "og:description", content: "Grow a community and unlock what it can become." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunitiesPage,
});

const COMMUNITY_UNLOCKS = [
  { level: 5, name: "Channel layouts", rarity: "common" as const },
  { level: 10, name: "Custom role colours", rarity: "uncommon" as const },
  { level: 15, name: "Animated background", rarity: "rare" as const },
  { level: 20, name: "Community decorations", rarity: "epic" as const },
  { level: 25, name: "Larger community space", rarity: "legendary" as const },
];

function CommunitiesPage() {
  const { award } = useDimted();
  const [activeId, setActiveId] = useState(COMMUNITIES[0]!.id);
  const community = COMMUNITIES.find((c) => c.id === activeId)!;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Communities"
        title="Places that grow with the people in them"
        blurb="A community earns XP from real participation — events, conversations, challenges, and members who stay."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {COMMUNITIES.map((c, i) => (
          <Panel
            key={c.id}
            delay={i * 60}
            className={cn(
              "cursor-pointer p-5 transition-colors",
              activeId === c.id ? "border-primary/40" : "hover:border-primary/25",
            )}
          >
            <button className="w-full text-left" onClick={() => setActiveId(c.id)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold tracking-tight">{c.name}</h2>
                  <p className="text-muted-foreground mt-1 text-xs">{c.tagline}</p>
                </div>
                <RarityChip rarity={c.accent} />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="numeral text-2xl">{c.level}</span>
                <span className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
                  community level
                </span>
              </div>
              <Meter value={c.xpInto / c.xpNeeded} className="mt-2 h-1.5" tone="primary" />
              <div className="text-muted-foreground mt-2 flex items-center justify-between font-mono text-[10px]">
                <span>
                  {c.xpInto.toLocaleString()}/{c.xpNeeded.toLocaleString()} XP
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="size-3" /> {c.members.toLocaleString()} · {c.online} online
                </span>
              </div>
              <p className={cn("mt-3 text-[11px]", rarityText[c.accent])}>{c.unlockNext}</p>
            </button>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-6 xl:col-span-2" delay={160}>
          <PanelHead eyebrow={community.name} title="Channels" aside={`${community.channels.length} open`} />
          <div className="mt-4 space-y-2">
            {community.channels.map((ch) => (
              <div
                key={ch.name}
                className="border-border bg-background/40 hover:border-primary/30 flex items-center gap-3 rounded-xl border p-3.5 transition-colors"
              >
                <Hash className="text-muted-foreground size-4 shrink-0" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{ch.name}</p>
                  <p className="text-muted-foreground truncate text-xs">{ch.topic}</p>
                </div>
                {ch.live ? (
                  <span className="text-uncommon flex shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase">
                    <Radio className="size-3" /> live
                  </span>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    const r = award("community", 60, `${community.name} · #${ch.name}`);
                    if (r === "cooldown") toast("Already counted today for this community.");
                  }}
                >
                  Join in
                </Button>
              </div>
            ))}
          </div>

          <div className="border-border mt-5 border-t pt-4">
            <p className="eyebrow">Community challenge</p>
            <div className="mt-3 flex items-center gap-4">
              <Meter value={0.62} className="h-2 flex-1" tone="gold" />
              <span className="text-muted-foreground font-mono text-[11px]">62% · everyone contributes</span>
            </div>
          </div>
        </Panel>

        <Panel className="p-6" delay={200}>
          <PanelHead eyebrow="Community path" title="What growing unlocks" />
          <div className="mt-4 space-y-2.5">
            {COMMUNITY_UNLOCKS.map((u) => {
              const unlocked = community.level >= u.level;
              return (
                <div
                  key={u.level}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    unlocked ? "border-border bg-background/40" : "border-dashed border-border/60 opacity-70",
                  )}
                >
                  <span className="bg-secondary numeral grid size-8 shrink-0 place-items-center rounded-lg text-xs">
                    {u.level}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm">{u.name}</p>
                  <RarityChip rarity={u.rarity} />
                </div>
              );
            })}
          </div>
          <LockedTile
            className="mt-4"
            hint="A community-only area"
            requirement="Community Level 30 · never announced"
          />
        </Panel>
      </div>
    </div>
  );
}
