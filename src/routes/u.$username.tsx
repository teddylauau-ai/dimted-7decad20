import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { Coins, MessageCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, Nametag } from "@/components/dimted/Identity";
import { LockedTile, Meter, Panel, PanelHead, RarityChip } from "@/components/dimted/primitives";
import { rarityBorder, rarityText } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { bannerFor, SLOTS, type Cosmetic } from "@/lib/cosmetics";
import {
  useCosmetics,
  useFriendships,
  useInventory,
  useProfileByUsername,
  isRecentlyActive,
} from "@/lib/dimted-queries";
import { sendFriendRequest } from "@/lib/dimted-actions";
import { useDimted } from "@/lib/dimted-store";
import { levelFromTotalXp, rankForLevel, UNLOCKS } from "@/lib/dimted";
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
        <div className="relative h-40" style={{ background: bannerFor(person.equipped_banner) }}>
          {person.banner_url ? (
            <img
              src={person.banner_url}
              alt={`${person.display_name}'s banner`}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="animate-breathe absolute inset-0 bg-[radial-gradient(40%_60%_at_50%_50%,oklch(0.7_0.12_300/0.16),transparent_70%)]" />
          )}
        </div>
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-5">
            <div className="flex items-end gap-4">
              <Avatar profile={person} size={84} className="glass-raised text-2xl" />
              <div className="pb-1">
                <Nametag
                  profile={person}
                  as="h1"
                  className="font-display text-2xl font-semibold tracking-tight"
                />
                <p className="text-muted-foreground font-mono text-[11px]">
                  @{person.username} · <span className="text-primary">{person.title}</span> ·{" "}
                  {rankForLevel(derived.level)}
                </p>
                <p className="text-muted-foreground/70 mt-1 font-mono text-[10px]">
                  {isRecentlyActive(person.last_active_at) ? "Around right now" : "Away"} · joined{" "}
                  {new Date(person.created_at).toLocaleDateString()}
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
