import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Flame, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  ACHIEVEMENTS,
  ITEMS,
  RARITY_ORDER,
  TITLES,
  UNLOCKS,
  friendshipLevel,
  type Achievement,
} from "@/lib/dimted";
import { useDimted } from "@/lib/dimted-store";
import { useFriendships, usePlayerStats } from "@/lib/dimted-queries";
import { updateProfile } from "@/lib/dimted-actions";
import {
  LockedTile,
  Meter,
  Panel,
  PanelHead,
  RarityChip,
} from "@/components/dimted/primitives";
import { rarityBorder, rarityDot, rarityText } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      {
        property: "og:description",
        content: "A profile that shows how long you've been here, not what you paid.",
      },
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
  const { level, rank, intoLevel, needed, progress, totalXp, profile, refreshProfile } = useDimted();
  const stats = usePlayerStats(profile?.id, totalXp);
  const friends = useFriendships(profile?.id);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [realmName, setRealmName] = useState(profile?.realm_name ?? "");

  const ownedItems = ITEMS.filter((i) => i.requiredLevel <= level);
  const earned = ACHIEVEMENTS.filter((a) => a.earned(stats));
  const streaks = (friends.data ?? [])
    .filter((f) => f.status === "accepted" && f.streak > 0)
    .map((f) => ({ label: `Friendship · ${f.profile.display_name}`, days: f.streak }));

  async function save() {
    if (!profile) return;
    try {
      await updateProfile(profile.id, {
        display_name: displayName.trim() || profile.display_name,
        realm_name: realmName.trim() || profile.realm_name,
      });
      await refreshProfile();
      setEditing(false);
      toast.success("Profile updated.");
    } catch {
      toast.error("Couldn't save that");
    }
  }

  async function pickTitle(name: string) {
    if (!profile) return;
    await updateProfile(profile.id, { title: name });
    await refreshProfile();
  }

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden p-0">
        <div
          className="relative h-44"
          style={{
            background:
              "radial-gradient(60% 120% at 20% 120%, oklch(0.42 0.1 200 / 0.65), transparent 70%), radial-gradient(50% 100% at 82% -10%, oklch(0.5 0.12 82 / 0.4), transparent 70%), linear-gradient(120deg, oklch(0.22 0.045 262), oklch(0.15 0.032 258))",
          }}
        >
          <div
            className="animate-breathe absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(40% 60% at 50% 50%, oklch(0.7 0.12 300 / 0.22), transparent 70%)",
            }}
          />
        </div>
        <div className="relative px-6 pb-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-5">
            <div className="flex items-end gap-4">
              <span className="glass-raised numeral text-glow grid size-24 place-items-center rounded-3xl text-3xl">
                {level}
              </span>
              <div className="pb-1">
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {profile?.display_name ?? "…"}
                </h1>
                <p className="text-muted-foreground font-mono text-[11px]">
                  @{profile?.username ?? "…"} ·{" "}
                  <span className="text-primary">{profile?.title ?? "Newcomer"}</span> · {rank}
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

          <div className="mt-5">
            {editing ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-40 flex-1"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                />
                <Input
                  className="min-w-40 flex-1"
                  value={realmName}
                  onChange={(e) => setRealmName(e.target.value)}
                  placeholder="Realm name"
                />
                <Button size="sm" onClick={() => void save()}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={level < 2}
                onClick={() => {
                  setDisplayName(profile?.display_name ?? "");
                  setRealmName(profile?.realm_name ?? "");
                  setEditing(true);
                }}
              >
                {level < 2 ? "Customisation unlocks at Level 2" : "Edit profile"}
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-6" delay={60}>
          <PanelHead eyebrow="Displayed under your name" title="Titles" />
          <div className="mt-4 flex flex-wrap gap-2">
            {TITLES.map((t) => {
              const owned = level >= t.requiredLevel;
              return (
                <button
                  key={t.name}
                  disabled={!owned}
                  onClick={() => void pickTitle(t.name)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors",
                    owned
                      ? profile?.title === t.name
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border hover:border-primary/40"
                      : "border-border/50 text-muted-foreground/50 border-dashed",
                  )}
                >
                  {owned ? (
                    t.name
                  ) : (
                    <>
                      <Lock className="inline size-3" /> Lv {t.requiredLevel}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-border mt-6 border-t pt-4">
            <p className="eyebrow">Streaks · never punishing</p>
            <div className="mt-3 space-y-2">
              {[
                ...(profile?.streak ? [{ label: "Daily activity", days: profile.streak }] : []),
                ...streaks,
              ].length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No streaks yet. Talk to someone two days in a row to start one.
                </p>
              ) : (
                [
                  ...(profile?.streak ? [{ label: "Daily activity", days: profile.streak }] : []),
                  ...streaks,
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <Flame className="text-energy size-3.5 shrink-0" />
                    <p className="min-w-0 flex-1 truncate text-sm">{s.label}</p>
                    <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                      {s.days} days
                    </span>
                  </div>
                ))
              )}
            </div>
            <p className="text-muted-foreground/70 mt-3 text-[11px]">
              Miss a day and a streak pauses for 48 hours before it resets.
            </p>
          </div>

          <div className="border-border mt-6 border-t pt-4">
            <p className="eyebrow">Best friendship</p>
            <p className="numeral mt-2 text-2xl">
              {stats.bestFriendshipLevel || 0}
              <span className="text-muted-foreground ml-2 font-mono text-[11px]">
                {stats.bestFriendshipLevel
                  ? friendshipLevel(0).name && ""
                  : "no friendships yet"}
              </span>
            </p>
          </div>
        </Panel>

        <Panel className="p-6 xl:col-span-2" delay={100}>
          <PanelHead
            eyebrow="Progression path"
            title="What your level has opened"
            aside={`${UNLOCKS.filter((u) => u.level <= level).length}/${UNLOCKS.length}`}
          />
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {UNLOCKS.map((u) => {
              const has = level >= u.level;
              return (
                <div
                  key={u.level}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5",
                    has
                      ? cn("bg-background/40", rarityBorder[u.rarity])
                      : "border-border/60 border-dashed opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "numeral grid size-8 shrink-0 place-items-center rounded-lg text-xs",
                      has
                        ? cn("bg-secondary", rarityText[u.rarity])
                        : "bg-secondary/50 text-muted-foreground",
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

      <Panel className="p-6" delay={140}>
        <PanelHead
          eyebrow="Seven categories"
          title="Achievements"
          aside={`${earned.length}/${ACHIEVEMENTS.length} unlocked`}
        />
        <div className="mt-5 space-y-5">
          {CATEGORIES.map((cat) => {
            const list = ACHIEVEMENTS.filter((a) => a.category === cat);
            if (!list.length) return null;
            return (
              <div key={cat}>
                <p className="eyebrow">{cat}</p>
                <div className="mt-2.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((a) => {
                    const has = a.earned(stats);
                    return cat === "Secret" && !has ? (
                      <LockedTile key={a.id} hint={a.detail} requirement="Unknown requirement" />
                    ) : (
                      <div
                        key={a.id}
                        className={cn(
                          "rounded-xl border p-3.5",
                          has
                            ? cn("bg-background/40", rarityBorder[a.rarity])
                            : "border-border/60 border-dashed opacity-70",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display truncate text-sm font-semibold">{a.name}</p>
                          <RarityChip rarity={a.rarity} />
                        </div>
                        <p className="text-muted-foreground mt-1.5 text-xs">{a.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel className="p-6" delay={180}>
        <PanelHead
          eyebrow="Inventory"
          title="Collection"
          aside={`${ownedItems.length}/${ITEMS.length} · earned, never bought`}
        />
        <div className="text-muted-foreground mt-4 flex flex-wrap gap-3 font-mono text-[10px] tracking-[0.16em] uppercase">
          {RARITY_ORDER.map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", rarityDot[r])} /> {r}
            </span>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ITEMS.map((i) => {
            const owned = i.requiredLevel <= level;
            return (
              <div
                key={i.id}
                className={cn(
                  "rounded-xl border p-3",
                  owned
                    ? cn("bg-background/40", rarityBorder[i.rarity])
                    : "border-border/60 border-dashed opacity-60",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-lg font-mono text-xs",
                    owned
                      ? cn(rarityText[i.rarity], "bg-secondary")
                      : "bg-secondary/50 text-muted-foreground",
                  )}
                >
                  {owned ? i.type[0] : <Lock className="size-3.5" />}
                </span>
                <p
                  className={cn(
                    "mt-2 truncate text-[10px] tracking-[0.14em] uppercase",
                    rarityText[i.rarity],
                  )}
                >
                  {i.rarity}
                </p>
                <p className="truncate text-sm">{owned ? i.name : "Undiscovered"}</p>
                <p className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
                  {i.source}
                </p>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
