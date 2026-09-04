import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Coins, MessageCircle, UserPlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Nametag, PresenceLabel } from "@/components/dimted/Identity";
import { EmptyState, LockedTile, Meter, Panel, PanelHead, RarityChip } from "@/components/dimted/primitives";
import { RankBadge, RankPill } from "@/components/dimted/RankBadge";
import { HoloCardTrigger } from "@/components/dimted/HoloCard";
import { rarityBorder, rarityText } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { bannerFor, SLOTS, type Cosmetic } from "@/lib/cosmetics";
import {
  useCosmetics,
  usePublicPlayerDetail,
  useFriendships,
  useInventory,
  useProfileByUsername,
} from "@/lib/dimted-queries";
import { GAMES } from "@/lib/games";
import { ROLE_LABEL, useMyRole } from "@/lib/roles-queries";
import { sendFriendRequest } from "@/lib/dimted-actions";
import { useDimted } from "@/lib/dimted-store";
import { levelFromTotalXp, nextRank, rankForLevel, UNLOCKS } from "@/lib/dimted";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/u/$username")({
  head: () => ({
    meta: [
      { title: "Player profile — Dimted" },
      {
        name: "description",
        content:
          "Look at a Dimted player's level, rank, nametag, badges, unlocks and cosmetic collection. Only real signed-up accounts appear.",
      },
      { property: "og:title", content: "Player profile — Dimted" },
      {
        property: "og:description",
        content: "Levels, nametags and collections belonging to actual players.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { username } = useParams({ from: "/u/$username" });
  const { profile: me } = useDimted();
  const query = useProfileByUsername(username);
  const person = query.data;
  const inventory = useInventory(person?.id);
  const cosmetics = useCosmetics();
  const friends = useFriendships(me?.id);
  const detail = usePublicPlayerDetail(person?.id);
  const theirRole = useMyRole(person?.id);

  const owned = useMemo(() => new Set(inventory.data ?? []), [inventory.data]);
  const ownedItems = (cosmetics.data ?? []).filter((c) => owned.has(c.slug));
  const derived = levelFromTotalXp(person?.total_xp ?? 0);
  const isMe = !!me && me.id === person?.id;
  const relation = (friends.data ?? []).find((f) => f.profile.id === person?.id);

  if (query.isLoading) {
    return <p className="text-muted-foreground font-mono text-xs">Looking that handle up…</p>;
  }

  if (!person) {
    return (
      <Panel className="p-8 text-center">
        <p className="numeral text-2xl">No such player</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Nobody signed up with the handle @{username}. Dimted only shows real accounts.
        </p>
        <Link
          to="/discover"
          className="text-primary mt-4 inline-block font-mono text-xs hover:underline"
        >
          Search for real players →
        </Link>
      </Panel>
    );
  }

  async function addFriend() {
    if (!me || !person) return;
    try {
      await sendFriendRequest(me.id, person.id);
      toast.success(`Request sent to ${person.display_name}.`);
    } catch {
      toast.error("Couldn't send that request.");
    }
  }

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden p-0">
        <div
          className="relative h-36 w-full overflow-hidden sm:h-44"
          style={{ background: bannerFor(person.equipped_banner) }}
        >
          {person.banner_url ? (
            <img
              src={person.banner_url}
              alt={`${person.display_name}'s banner`}
              className="absolute inset-0 block h-full w-full object-cover object-center"
            />
          ) : (
            <div className="animate-breathe absolute inset-0 bg-[radial-gradient(40%_60%_at_50%_50%,oklch(0.7_0.12_300/0.16),transparent_70%)]" />
          )}
          <div className="from-card absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent" />
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-5 pt-5">
            <div className="flex items-end gap-4">
              <div className="relative shrink-0">
                <HoloCardTrigger profile={person}>
                  <Avatar profile={person} size={96} className="glass-raised rounded-2xl text-2xl" />
                </HoloCardTrigger>
                <div className="absolute -right-1 -top-1">
                  <RankBadge level={derived.level} size="sm" />
                </div>
              </div>
              <div className="pb-1">
                <Nametag
                  profile={person}
                  as="h1"
                  className="font-display text-2xl font-semibold tracking-tight"
                />
                <p className="text-muted-foreground font-mono text-[11px]">
                  @{person.username} · <span className="text-primary">{person.title || "Newcomer"}</span> ·{" "}
                  {rankForLevel(derived.level)}
                </p>
                <p className="text-muted-foreground/70 mt-1 font-mono text-[10px]">
                  joined {new Date(person.created_at).toLocaleDateString()}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  <PresenceLabel profile={person} />
                  <RankPill level={derived.level} />
                  {theirRole.role !== "member" ? (
                    <span className="border-gold/40 text-gold rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase">
                      {ROLE_LABEL[theirRole.role]}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="numeral text-3xl">{derived.level}</p>
              <Meter
                value={Math.min(1, derived.intoLevel / derived.needed)}
                tone="xp"
                className="mt-2 h-2 w-48"
              />
              <p className="text-muted-foreground mt-1.5 font-mono text-[10px]">
                {person.total_xp.toLocaleString()} XP lifetime
              </p>
            </div>
          </div>

          {person.bio ? <p className="text-foreground/90 mt-5 max-w-2xl text-sm">{person.bio}</p> : null}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Rank", value: rankForLevel(derived.level) },
              {
                label: "Next rank",
                value: nextRank(derived.level)
                  ? `${nextRank(derived.level)!.name} · Lv ${nextRank(derived.level)!.from}`
                  : "Maxed",
              },
              { label: "Arcade runs", value: (detail.data?.scores.length ?? 0).toLocaleString() },
              { label: "Collection", value: `${ownedItems.length} items` },
            ].map((stat) => (
              <div key={stat.label} className="border-border bg-background/40 rounded-xl border p-3">
                <p className="truncate text-sm font-medium">{stat.value}</p>
                <p className="text-muted-foreground mt-0.5 font-mono text-[10px] tracking-[0.18em] uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {!isMe ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {relation?.status === "accepted" ? (
                <Button size="sm" asChild>
                  <Link to="/messages">
                    <MessageCircle className="size-3.5" /> Message
                  </Link>
                </Button>
              ) : relation?.status === "pending" ? (
                <Button size="sm" variant="secondary" disabled>
                  Request pending
                </Button>
              ) : (
                <Button size="sm" onClick={() => void addFriend()}>
                  <UserPlus className="size-3.5" /> Add friend
                </Button>
              )}
            </div>
          ) : (
            <div className="mt-5">
              <Button size="sm" variant="outline" asChild>
                <Link to="/profile">Edit your profile</Link>
              </Button>
            </div>
          )}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-6" delay={60}>
          <PanelHead eyebrow="Currently worn" title="Cosmetics" />
          <div className="mt-4 space-y-3">
            {SLOTS.map((s) => {
              const slug = {
                nametag: person.equipped_nametag,
                badge: person.equipped_badge,
                frame: person.equipped_frame,
                banner: person.equipped_banner,
                effect: person.equipped_effect,
              }[s.slot];
              const item = (cosmetics.data ?? []).find((c: Cosmetic) => c.slug === slug);
              return (
                <div key={s.slot} className="flex items-center justify-between gap-3">
                  <p className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-[11px]">
                    {s.label}
                  </p>
                  {item ? (
                    <span className={cn("truncate text-sm", rarityText[item.rarity])}>
                      {item.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60 text-sm">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-6 xl:col-span-2" delay={100}>
          <PanelHead
            eyebrow="Collection"
            title="What they've earned"
            aside={`${ownedItems.length} item${ownedItems.length === 1 ? "" : "s"}`}
          />
          {ownedItems.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              Nothing collected yet — they're still early.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ownedItems.map((item) => (
                <div
                  key={item.slug}
                  className={cn("bg-background/40 rounded-xl border p-3", rarityBorder[item.rarity])}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm">{item.name}</p>
                    <RarityChip rarity={item.rarity} />
                  </div>
                  <p className="text-muted-foreground mt-1 flex items-center gap-1.5 font-mono text-[10px]">
                    <Coins className="size-3" /> {item.price_sparks.toLocaleString()} Sparks
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="p-6" delay={120}>
        <PanelHead
          eyebrow="Arcade record"
          title="Personal bests"
          aside={
            detail.data?.campaign.length
              ? `${detail.data.campaign.reduce((n, c) => n + c.stars, 0)} stars`
              : undefined
          }
        />
        {(() => {
          const bests = new Map<string, number>();
          (detail.data?.scores ?? []).forEach((row) => {
            bests.set(row.game, Math.max(bests.get(row.game) ?? 0, row.score));
          });
          const rows = GAMES.filter((g) => bests.has(g.id) || false);
          if (rows.length === 0) {
            return (
              <p className="text-muted-foreground mt-4 text-sm">
                They haven't posted an arcade score yet.
              </p>
            );
          }
          const top = Math.max(...rows.map((g) => bests.get(g.id) ?? 0), 1);
          return (
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((g) => {
                const campaign = detail.data?.campaign.find((c) => c.game === g.id);
                return (
                  <div key={g.id} className="border-border bg-background/40 rounded-xl border p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm">{g.name}</p>
                      <span className="numeral text-primary text-sm">
                        {(bests.get(g.id) ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <Meter
                      value={(bests.get(g.id) ?? 0) / top}
                      tone="primary"
                      className="mt-2 h-1.5"
                    />
                    {campaign ? (
                      <p className="text-muted-foreground mt-1.5 font-mono text-[10px]">
                        Campaign Lv {campaign.level} · {campaign.stars}★
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Panel>

      <Panel className="p-6" delay={140}>
        <PanelHead
          eyebrow="Progression"
          title="Unlocks reached"
          aside={`${UNLOCKS.filter((u) => u.level <= derived.level).length}/${UNLOCKS.length}`}
        />
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {UNLOCKS.map((u) =>
            derived.level >= u.level ? (
              <div
                key={u.level}
                className={cn("bg-background/40 rounded-xl border p-3.5", rarityBorder[u.rarity])}
              >
                <p className="text-sm">{u.name}</p>
                <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">Level {u.level}</p>
              </div>
            ) : (
              <LockedTile
                key={u.level}
                hint="Not there yet"
                requirement={`Level ${u.level}`}
              />
            ),
          )}
        </div>
      </Panel>
    </div>
  );
}
