import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Camera, Check, Flame, Image as ImageIcon, Loader2, Lock, Trash2, Sparkles } from "lucide-react";
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
import { useCosmetics, useFriendships, usePlayerStats } from "@/lib/dimted-queries";
import { ROLE_LABEL, useMyRole } from "@/lib/roles-queries";
import {
  removeAvatar,
  removeBanner,
  updateProfile,
  uploadAvatar,
  uploadBanner,
} from "@/lib/dimted-actions";
import { bannerFor, SLOTS, type CosmeticSlot } from "@/lib/cosmetics";
import { Avatar, Nametag, PresenceLabel } from "@/components/dimted/Identity";
import {
  EmptyState,
  LockedTile,
  Meter,
  Panel,
  PanelHead,
  RarityChip,
} from "@/components/dimted/primitives";
import { RankBadge, RankPill } from "@/components/dimted/RankBadge";
import { HoloCardTrigger } from "@/components/dimted/HoloCard";
import { rarityBorder, rarityDot, rarityText } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Dimted" },
      {
        name: "description",
        content:
          "Your Dimted profile evolves with you: level and rank, titles, achievements across seven categories, and a collection graded common to mythic.",
      },
      { property: "og:title", content: "Profile — Dimted" },
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
  const myRole = useMyRole(profile?.id);
  const cosmetics = useCosmetics();
  const cosmeticBySlug = useMemo(
    () => new Map((cosmetics.data ?? []).map((c) => [c.slug, c])),
    [cosmetics.data],
  );
  const equipped: Record<CosmeticSlot, string | null> = {
    nametag: profile?.equipped_nametag ?? null,
    badge: profile?.equipped_badge ?? null,
    frame: profile?.equipped_frame ?? null,
    banner: profile?.equipped_banner ?? null,
    effect: profile?.equipped_effect ?? null,
  };


  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");

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
      });
      await refreshProfile();
      setEditing(false);
      toast.success("Profile updated.");
    } catch {
      toast.error("Couldn't save that");
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file || !profile) return;
    setUploading(true);
    try {
      await uploadAvatar(profile.id, file);
      await refreshProfile();
      toast.success("Profile picture updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function clearPhoto() {
    if (!profile) return;
    try {
      await removeAvatar(profile.id);
      await refreshProfile();
      toast("Back to your initials.");
    } catch {
      toast.error("Couldn't remove that");
    }
  }

  async function pickBanner(file: File | undefined) {
    if (!file || !profile) return;
    setBannerUploading(true);
    try {
      await uploadBanner(profile.id, file);
      await refreshProfile();
      toast.success("Banner updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBannerUploading(false);
      if (bannerInput.current) bannerInput.current.value = "";
    }
  }

  async function clearBanner() {
    if (!profile) return;
    try {
      await removeBanner(profile.id);
      await refreshProfile();
      toast("Banner image removed.");
    } catch {
      toast.error("Couldn't remove that");
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
        <div className="relative h-36 w-full overflow-hidden sm:h-44">
          <div
            className="absolute inset-0"
            style={{ background: bannerFor(profile?.equipped_banner) }}
          />
          {profile?.banner_url ? (
            <img
              src={profile.banner_url}
              alt="Your profile banner"
              className="absolute inset-0 block h-full w-full object-cover object-center"
            />
          ) : (
            <div
              className="animate-breathe absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(40% 60% at 50% 50%, oklch(0.7 0.12 300 / 0.22), transparent 70%)",
              }}
            />
          )}
          {/* scrim so the name and avatar below always stay readable */}
          <div className="from-card absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent" />
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            <button
              type="button"
              onClick={() => bannerInput.current?.click()}
              disabled={bannerUploading}
              className="glass-raised text-foreground/90 hover:text-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px]"
            >
              {bannerUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5" />
              )}
              {profile?.banner_url ? "Change banner" : "Upload banner"}
            </button>
            {profile?.banner_url ? (
              <button
                type="button"
                onClick={() => void clearBanner()}
                aria-label="Remove banner image"
                className="glass-raised text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-full"
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : null}
          </div>
          <input
            ref={bannerInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/*"
            className="hidden"
            onChange={(e) => void pickBanner(e.target.files?.[0])}
          />
        </div>
        <div className="relative px-6 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-5 pt-5">
            <div className="flex min-w-0 items-end gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  aria-label="Change profile picture"
                  className="group focus-visible:ring-ring relative block rounded-2xl focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Avatar profile={profile} size={96} className="glass-raised rounded-2xl" />
                  <span className="bg-background/70 absolute inset-0 grid place-items-center rounded-2xl opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <Camera className="size-5" />
                    )}
                  </span>
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/*"
                  className="hidden"
                  onChange={(e) => void pickPhoto(e.target.files?.[0])}
                />
                {profile?.avatar_url ? (
                  <button
                    type="button"
                    onClick={() => void clearPhoto()}
                    aria-label="Remove profile picture"
                    className="border-border bg-card text-muted-foreground hover:text-foreground absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full border"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <div className="min-w-0 pb-1">
                <Nametag
                  profile={profile}
                  as="h1"
                  className="font-display text-2xl font-semibold tracking-tight"
                />
                <p className="text-muted-foreground font-mono text-[11px]">
                  @{profile?.username ?? "…"} ·{" "}
                  <span className="text-primary">{profile?.title ?? "Newcomer"}</span> · {rank}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2">
                  <PresenceLabel profile={profile} />
                  {myRole.role !== "member" ? (
                    <span className="border-gold/40 text-gold rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase">
                      {ROLE_LABEL[myRole.role]}
                    </span>
                  ) : null}
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

          <div className="border-border mt-5 border-t pt-4">
            <div className="flex items-end justify-between gap-4">
              <p className="eyebrow">Worn right now</p>
              <Link to="/shop" className="text-primary font-mono text-[11px] hover:underline">
                Change in the shop →
              </Link>
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {SLOTS.map(({ slot, label }) => {
                const slug = equipped[slot];
                const item = slug ? cosmeticBySlug.get(slug) : undefined;
                return (
                  <div
                    key={slot}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                      item
                        ? cn("bg-background/40", rarityBorder[item.rarity])
                        : "border-border/60 border-dashed",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
                        {label}
                      </p>
                      <p
                        className={cn(
                          "truncate text-sm",
                          item ? rarityText[item.rarity] : "text-muted-foreground/60",
                        )}
                      >
                        {item?.name ?? (slug ?? "Nothing equipped")}
                      </p>
                    </div>
                    {item ? <RarityChip rarity={item.rarity} /> : null}
                  </div>
                );
              })}
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
