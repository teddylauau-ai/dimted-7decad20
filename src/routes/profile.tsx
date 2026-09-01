import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Flame, Lock } from "lucide-react";
import {
  ACHIEVEMENTS,
  ITEMS,
  RARITY_ORDER,
  TITLES,
  UNLOCKS,
  type Achievement,
} from "@/lib/dimted";
import { useDimted } from "@/lib/dimted-store";
import { LockedTile, Meter, Panel, PanelHead, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { rarityBorder, rarityDot, rarityText } from "@/components/dimted/rarity";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — DIMTED" },
      {
        name: "description",
        content:
          "Your DIMTED profile evolves with you: level and rank, titles, achievements across seven categories, and a collection graded common to mythic.",
      },
      { property: "og:title", content: "Profile — DIMTED" },
      { property: "og:description", content: "A profile that shows how long you've been here, not what you paid." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const CATEGORIES: Achievement["category"][] = [
  "Social",
  "Community",
  "Exploration",
  "Gaming",
  "Collection",
  "Progression",
  "Secret",
];

function ProfilePage() {
  const { level, rank, intoLevel, needed, progress, totalXp } = useDimted();
  const [title, setTitle] = useState("Night Owl");
  const owned = ITEMS.filter((i) => i.owned);

  return (
    <div className="space-y-5">
      {/* Evolving profile banner — depth increases with level */}
      <Panel className="overflow-hidden p-0">
        <div
          className="relative h-44"
          style={{
            background:
              "radial-gradient(60% 120% at 20% 120%, oklch(0.42 0.1 200 / 0.65), transparent 70%), radial-gradient(50% 100% at 82% -10%, oklch(0.5 0.12 82 / 0.4), transparent 70%), linear-gradient(120deg, oklch(0.22 0.045 262), oklch(0.15 0.032 258))",
          }}
        >
          <div className="animate-breathe absolute inset-0" style={{ backgroundImage: "radial-gradient(40% 60% at 50% 50%, oklch(0.7 0.12 300 / 0.22), transparent 70%)" }} />
        </div>
        <div className="relative px-6 pb-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-5">
            <div className="flex items-end gap-4">
              <span className="glass-raised numeral text-glow grid size-24 place-items-center rounded-3xl text-3xl">
                {level}
              </span>
              <div className="pb-1">
                <h1 className="font-display text-2xl font-semibold tracking-tight">Mara Voss</h1>
                <p className="text-muted-foreground font-mono text-[11px]">
                  @mara · <span className="text-primary">{title}</span> · {rank}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground font-mono text-xs">
                {intoLevel.toLocaleString()} / {needed.toLocaleString()} XP
              </p>
              <Meter value={progress} tone="xp" className="mt-2 h-2 w-56" animate />
              <p className="text-muted-foreground/70 mt-1.5 font-mono text-[10px]">
                {totalXp.toLocaleString()} XP lifetime
              </p>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Titles */}
        <Panel className="p-6" delay={60}>
          <PanelHead eyebrow="Displayed under your name" title="Titles" />
          <div className="mt-4 flex flex-wrap gap-2">
            {TITLES.map((t) => (
              <button
                key={t.name}
                disabled={!t.owned}
                onClick={() => setTitle(t.name)}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors",
                  t.owned
                    ? title === t.name
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border hover:border-primary/40"
                    : "border-border/50 text-muted-foreground/50 border-dashed",
                )}
              >
                {t.owned ? t.name : <Lock className="inline size-3" />} {t.owned ? null : t.name}
              </button>
            ))}
          </div>

          <div className="border-border mt-6 border-t pt-4">
            <p className="eyebrow">Streaks · never punishing</p>
            <div className="mt-3 space-y-2">
              {[
                { label: "Daily activity", days: 6 },
                { label: "Friendship · Alex", days: 12 },
                { label: "Driftworks participation", days: 4 },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <Flame className="text-energy size-3.5 shrink-0" />
                  <p className="min-w-0 flex-1 truncate text-sm">{s.label}</p>
                  <span className="text-muted-foreground shrink-0 font-mono text-[11px]">{s.days} days</span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground/70 mt-3 text-[11px]">
              Miss a day and a streak pauses for 48 hours before it resets.
            </p>
          </div>
        </Panel>

        {/* Unlock path */}
        <Panel className="p-6 xl:col-span-2" delay={100}>
          <PanelHead eyebrow="Progression path" title="What your level has opened" aside={`${UNLOCKS.filter((u) => u.level <= level).length}/${UNLOCKS.length}`} />
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {UNLOCKS.map((u) => {
              const has = level >= u.level;
              return (
                <div
                  key={u.level}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5",
                    has ? cn("bg-background/40", rarityBorder[u.rarity]) : "border-border/60 border-dashed opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "numeral grid size-8 shrink-0 place-items-center rounded-lg text-xs",
                      has ? cn("bg-secondary", rarityText[u.rarity]) : "bg-secondary/50 text-muted-foreground",
                    )}
                  >
                    {u.level}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm">{u.name}</p>
                      {has ? <Check className="text-uncommon size-3.5 shrink-0" /> : null}
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">{u.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Achievements */}
      <Panel className="p-6" delay={140}>
        <PanelHead
          eyebrow="Seven categories"
          title="Achievements"
          aside={`${ACHIEVEMENTS.filter((a) => a.earned).length}/${ACHIEVEMENTS.length} unlocked`}
        />
        <div className="mt-5 space-y-5">
          {CATEGORIES.map((cat) => {
            const list = ACHIEVEMENTS.filter((a) => a.category === cat);
            if (!list.length) return null;
            return (
              <div key={cat}>
                <p className="eyebrow">{cat}</p>
                <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((a) =>
                    cat === "Secret" && !a.earned ? (
                      <LockedTile key={a.id} hint={a.detail} requirement="Unknown requirement" />
                    ) : (
                      <div
                        key={a.id}
                        className={cn(
                          "rounded-xl border p-3.5",
                          a.earned ? cn("bg-background/40", rarityBorder[a.rarity]) : "border-border/60 border-dashed opacity-70",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display truncate text-sm font-semibold">{a.name}</p>
                          <RarityChip rarity={a.rarity} />
                        </div>
                        <p className="text-muted-foreground mt-1.5 text-xs">{a.detail}</p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Collection */}
      <Panel className="p-6" delay={180}>
        <PanelHead
          eyebrow="Inventory"
          title="Collection"
          aside={`${owned.length}/${ITEMS.length} · earned, never bought`}
        />
        <div className="text-muted-foreground mt-4 flex flex-wrap gap-3 font-mono text-[10px] tracking-[0.16em] uppercase">
          {RARITY_ORDER.map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", rarityDot[r])} /> {r}
            </span>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ITEMS.map((i) => (
            <div
              key={i.id}
              className={cn(
                "rounded-xl border p-3",
                i.owned ? cn("bg-background/40", rarityBorder[i.rarity]) : "border-border/60 border-dashed opacity-60",
              )}
            >
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-lg font-mono text-xs",
                  i.owned ? cn(rarityText[i.rarity], "bg-secondary") : "bg-secondary/50 text-muted-foreground",
                )}
              >
                {i.owned ? i.type[0] : <Lock className="size-3.5" />}
              </span>
              <p className={cn("mt-2 truncate text-[10px] tracking-[0.14em] uppercase", rarityText[i.rarity])}>
                {i.rarity}
              </p>
              <p className="truncate text-sm">{i.owned ? i.name : "Undiscovered"}</p>
              <p className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">{i.source}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
