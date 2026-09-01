import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EyeOff, Flame } from "lucide-react";
import { toast } from "sonner";
import { FEED, FRIENDS, FRIENDSHIP_TIERS, friendshipLevel } from "@/lib/dimted";
import { useDimted } from "@/lib/dimted-store";
import { Meter, Panel, PanelHead, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { rarityDot, rarityText } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — DIMTED" },
      {
        name: "description",
        content:
          "Friendship levels in DIMTED: every friendship progresses on its own, unlocking shared badges, matching effects and duo challenges.",
      },
      { property: "og:title", content: "Friends — DIMTED" },
      { property: "og:description", content: "Friendships that level up, privately and optionally." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendsPage,
});

const DUO_REWARDS = [
  { level: 2, name: "Shared badge", rarity: "common" as const },
  { level: 3, name: "Matching profile effect", rarity: "uncommon" as const },
  { level: 5, name: "Shared Realm decoration", rarity: "epic" as const },
  { level: 7, name: "Private chat reaction", rarity: "rare" as const },
  { level: 10, name: "Legendary Duo animation", rarity: "legendary" as const },
];

function FriendsPage() {
  const { award } = useDimted();
  const [selectedId, setSelectedId] = useState(FRIENDS[0]!.id);
  const [publicBonds, setPublicBonds] = useState(false);
  const friend = FRIENDS.find((f) => f.id === selectedId)!;
  const bond = friendshipLevel(friend.friendshipXp);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Friends"
        title="Every friendship keeps its own level"
        blurb="Built by talking, not by clicking. You can hide all of it from everyone else."
        aside={
          <label className="glass flex items-center gap-3 rounded-full px-4 py-2">
            <EyeOff className="text-muted-foreground size-3.5" />
            <span className="text-muted-foreground font-mono text-[11px]">Show bonds publicly</span>
            <Switch checked={publicBonds} onCheckedChange={setPublicBonds} />
          </label>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <Panel className="p-4">
          <ul className="space-y-1.5">
            {FRIENDS.map((f) => {
              const b = friendshipLevel(f.friendshipXp);
              return (
                <li key={f.id}>
                  <button
                    onClick={() => setSelectedId(f.id)}
                    className={cn(
                      "hover:bg-secondary/50 w-full rounded-xl p-3 text-left transition-colors",
                      selectedId === f.id && "bg-secondary",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "numeral text-primary-foreground grid size-10 shrink-0 place-items-center rounded-xl",
                          rarityDot[f.accent],
                        )}
                      >
                        {f.name[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{f.name}</p>
                          {f.online ? <span className="bg-uncommon size-1.5 rounded-full" /> : null}
                        </div>
                        <p className="text-muted-foreground truncate font-mono text-[10px]">
                          Lv {f.level} · {f.title}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("font-mono text-[11px]", rarityText[f.accent])}>FL {b.level}</p>
                        <p className="text-muted-foreground/70 font-mono text-[10px]">{b.name}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-3">
                      <Meter value={b.into / b.needed} className="h-1 flex-1" tone="xp" />
                      {f.streak ? (
                        <span className="text-energy flex shrink-0 items-center gap-1 font-mono text-[10px]">
                          <Flame className="size-3" /> {f.streak}d
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 shrink-0 font-mono text-[10px]">no streak</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="space-y-5">
          <Panel className="p-6" delay={80}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Friendship</p>
                <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight">
                  {friend.name.split(" ")[0]} & you
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Level {bond.level} · {bond.name}
                  {friend.streak ? ` · ${friend.streak}-day streak` : " · streak paused, nothing lost"}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  const r = award("activity", 180, `Duo Quest with ${friend.name.split(" ")[0]}`);
                  if (r === "cooldown") toast("Duo Quests are limited — the point is that they mean something.");
                }}
              >
                Start Duo Quest
              </Button>
            </div>

            <Meter value={bond.into / bond.needed} className="mt-5 h-2.5" tone="xp" animate />
            <p className="text-muted-foreground mt-2 font-mono text-[11px]">
              {bond.into}/{bond.needed} toward Friendship Level {bond.level + 1}
            </p>

            <div className="border-border mt-5 grid gap-2 border-t pt-4 sm:grid-cols-2">
              {FRIENDSHIP_TIERS.map((t) => (
                <div
                  key={t.level}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-[11px]",
                    bond.level >= t.level ? "bg-secondary text-foreground" : "text-muted-foreground/70",
                  )}
                >
                  <span className="numeral">{t.level}</span> {t.name}
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-6" delay={120}>
            <PanelHead eyebrow="Together" title="Shared rewards" />
            <div className="mt-4 space-y-2.5">
              {DUO_REWARDS.map((r) => {
                const earned = bond.level >= r.level;
                return (
                  <div
                    key={r.level}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3",
                      earned ? "border-border bg-background/40" : "border-border/60 border-dashed opacity-70",
                    )}
                  >
                    <span className="bg-secondary numeral grid size-8 shrink-0 place-items-center rounded-lg text-xs">
                      {r.level}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm">{r.name}</p>
                    <RarityChip rarity={r.rarity} />
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel className="p-6" delay={160}>
            <PanelHead eyebrow="Friend activity" title="What they've been up to" />
            <ul className="mt-4 space-y-1">
              {FEED.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-1 py-1.5">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", rarityDot[e.tone])} />
                  <p className="text-muted-foreground min-w-0 flex-1 text-sm">
                    <span className="text-foreground">{e.who}</span> {e.what}{" "}
                    <span className={rarityText[e.tone]}>{e.highlight}</span>
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
