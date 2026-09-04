import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Flame, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Meter, Panel, PanelHead, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import { IdentityRow } from "@/components/dimted/Identity";
import { FRIENDSHIP_TIERS, friendshipLevel } from "@/lib/dimted";
import { isRecentlyActive, useFriendships, useRefreshDimted } from "@/lib/dimted-queries";
import { respondToFriendRequest } from "@/lib/dimted-actions";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — Lazu" },
      {
        name: "description",
        content:
          "Friendship Levels, streaks and duo rewards in Lazu. Every friendship has its own progression track.",
      },
      { property: "og:title", content: "Friends — Lazu" },
      { property: "og:description", content: "Friendships level up too." },
    ],
  }),
  component: FriendsPage,
});

export function FriendsPage() {
  const { profile, award } = useDimted();
  const friends = useFriendships(profile?.id);
  const refresh = useRefreshDimted();

  const rows = friends.data ?? [];
  const accepted = rows.filter((f) => f.status === "accepted");
  const incoming = rows.filter((f) => f.status === "pending" && f.requesterId !== profile?.id);
  const outgoing = rows.filter((f) => f.status === "pending" && f.requesterId === profile?.id);

  async function respond(id: string, accept: boolean) {
    try {
      await respondToFriendRequest(id, accept);
      await friends.refetch();
      if (accept) {
        await award("friend", "New friend");
        toast.success("Friendship started at Level 1.");
      }
      refresh();
    } catch {
      toast.error("Couldn't update that request");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Social"
        title="Friends"
        blurb="Each friendship has its own level. Talking regularly is the only thing that raises it."
        aside={
          <div className="text-right">
            <p className="numeral text-3xl">{accepted.length}</p>
            <p className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
              friends
            </p>
          </div>
        }
      />

      {incoming.length > 0 ? (
        <Panel className="p-5">
          <PanelHead eyebrow="Waiting on you" title="Friend requests" />
          <ul className="mt-4 space-y-2">
            {incoming.map((f) => (
              <li
                key={f.friendshipId}
                className="border-border bg-background/40 flex items-center gap-3 rounded-xl border p-3"
              >
                <IdentityRow profile={f.profile} meta={`@${f.profile.username}`} className="flex-1" />
                <Button size="sm" onClick={() => void respond(f.friendshipId, true)}>
                  <Check className="size-3.5" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void respond(f.friendshipId, false)}
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {accepted.length === 0 ? (
        <Panel className="p-8 text-center">
          <p className="font-display text-lg font-semibold">Nobody here yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            Lazu never gives you fake friends. Every name on this page is a real account that
            accepted you.
          </p>
          <Button asChild className="mt-5">
            <Link to="/discover">Find real people</Link>
          </Button>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accepted.map((f, i) => {
            const lvl = friendshipLevel(f.friendshipXp);
            const tier = FRIENDSHIP_TIERS.find((t) => t.level > lvl.level);
            return (
              <Panel key={f.friendshipId} className="p-4" delay={i * 40}>
                <div className="flex items-start justify-between gap-3">
                  <IdentityRow profile={f.profile} meta={`@${f.profile.username}`} />
                  <span className="text-primary shrink-0 font-mono text-[11px]">FL {lvl.level}</span>
                </div>

                <Meter value={lvl.into / lvl.needed} tone="gold" className="mt-3 h-1.5" />
                <p className="text-muted-foreground mt-2 font-mono text-[10px]">
                  {lvl.into}/{lvl.needed} · {lvl.name}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {f.streak > 0 ? (
                    <span className="border-gold/30 bg-gold/10 text-gold flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px]">
                      <Flame className="size-3" />
                      {f.streak}d
                    </span>
                  ) : null}
                  {isRecentlyActive(f.profile.last_active_at) ? (
                    <span className="border-primary/30 bg-primary/10 text-primary rounded-full border px-2 py-0.5 font-mono text-[10px]">
                      around now
                    </span>
                  ) : null}
                </div>

                {tier ? (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Level {tier.level} makes you <span className="text-foreground/85">{tier.name}</span>.
                  </p>
                ) : null}

                <Button asChild size="sm" variant="outline" className="mt-3 w-full">
                  <Link to="/messages">Open chat</Link>
                </Button>
              </Panel>
            );
          })}
        </div>
      )}

      {outgoing.length > 0 ? (
        <Panel className="p-5">
          <PanelHead eyebrow="Sent" title="Waiting on them" />
          <ul className="mt-3 space-y-1.5">
            {outgoing.map((f) => (
              <li key={f.friendshipId} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{f.profile.display_name}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">pending</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel className="p-5">
        <PanelHead eyebrow="Duo rewards" title="What friendships unlock" />
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {FRIENDSHIP_TIERS.map((t) => (
            <li
              key={t.level}
              className="border-border bg-background/40 flex items-center gap-3 rounded-xl border p-3"
            >
              <span className="numeral text-muted-foreground w-8 shrink-0 text-lg">{t.level}</span>
              <span className="flex-1 text-sm">{t.name}</span>
              <RarityChip rarity={t.level >= 10 ? "legendary" : t.level >= 5 ? "epic" : "uncommon"} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
