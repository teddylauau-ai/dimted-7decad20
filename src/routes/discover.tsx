import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LockedTile, Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import { IdentityRow } from "@/components/dimted/Identity";
import { SECRETS, communityLevel, levelFromTotalXp } from "@/lib/dimted";
import {
  isRecentlyActive,
  searchProfiles,
  useCommunities,
  useFriendships,
  useNewestProfiles,
  useRefreshDimted,
  type PublicProfile,
} from "@/lib/dimted-queries";
import { joinCommunity, sendFriendRequest } from "@/lib/dimted-actions";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Dimted" },
      {
        name: "description",
        content:
          "Find real Dimted accounts, open communities, visitable Realms and the secrets still hidden at your level.",
      },
      { property: "og:title", content: "Discover — Dimted" },
      { property: "og:description", content: "Everything you find here is real." },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { profile, level, award } = useDimted();
  const friends = useFriendships(profile?.id);
  const communities = useCommunities(profile?.id);
  const newest = useNewestProfiles(profile?.id);
  const refresh = useRefreshDimted();

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PublicProfile[] | null>(null);
  const [busy, setBusy] = useState(false);

  const knownIds = new Set((friends.data ?? []).map((f) => f.profile.id));
  const people = results ?? newest.data ?? [];

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    try {
      setResults(await searchProfiles(term, profile.id));
    } catch {
      toast.error("Search failed");
    } finally {
      setBusy(false);
    }
  }

  async function addFriend(target: PublicProfile) {
    if (!profile) return;
    try {
      await sendFriendRequest(profile.id, target.id);
      await friends.refetch();
      await award("discovery", `Found ${target.display_name}`);
      refresh();
      toast.success(`Request sent to ${target.display_name}.`);
    } catch {
      toast.error("Request already exists or couldn't be sent");
    }
  }

  async function join(id: string) {
    if (!profile) return;
    try {
      await joinCommunity(id, profile.id);
      await communities.refetch();
      await award("discovery", "Joined a community");
      refresh();
    } catch {
      toast.error("Couldn't join");
    }
  }

  const openCommunities = (communities.data ?? []).filter((c) => !c.isMember);
  const visitableRealms = (newest.data ?? []).filter(
    (p) => levelFromTotalXp(p.total_xp).level >= 20,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Explore"
        title="Discover"
        blurb="Real accounts, real communities, real Realms. Nothing on this page is generated."
      />

      <Panel className="p-5">
        <PanelHead eyebrow="People" title={results ? "Search results" : "Newest in Dimted"} />
        <form onSubmit={search} className="mt-4 flex gap-2">
          <Input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              if (!e.target.value) setResults(null);
            }}
            placeholder="Search by name or @username"
          />
          <Button type="submit" variant="outline" disabled={busy || term.trim().length < 2}>
            <Search className="size-4" />
          </Button>
        </form>

        {people.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-sm">
            Nobody matches yet. Dimted is only as full as the people who join it.
          </p>
        ) : (
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {people.map((p) => (
              <li
                key={p.id}
                className="border-border bg-background/40 flex items-center gap-3 rounded-xl border p-3"
              >
                <IdentityRow
                  profile={p}
                  className="flex-1 p-1"
                  meta={`Lv ${levelFromTotalXp(p.total_xp).level} · @${p.username}${
                    isRecentlyActive(p.last_active_at) ? " · around now" : ""
                  }`}
                />
                {knownIds.has(p.id) ? (
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">known</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void addFriend(p)}>
                    <UserPlus className="size-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5" delay={60}>
          <PanelHead eyebrow="Communities" title="Open to join" />
          {openCommunities.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              No open communities right now. Create the first one.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {openCommunities.map((c) => (
                <li
                  key={c.id}
                  className="border-border bg-background/40 flex items-center gap-3 rounded-xl border p-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      Lv {communityLevel(c.total_xp).level} · {c.memberCount} member
                      {c.memberCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => void join(c.id)}>
                    Join
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5" delay={100}>
          <PanelHead eyebrow="Realms" title="Visitable spaces" aside="unlocks at Lv 20" />
          {visitableRealms.length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              Nobody has reached Level 20 yet, so no Realm is open to visitors. Yours could be first.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {visitableRealms.map((p) => (
                <li
                  key={p.id}
                  className="border-border bg-background/40 rounded-xl border p-3 text-sm"
                >
                  <span className="block font-medium">{p.realm_name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {p.display_name} · Lv {levelFromTotalXp(p.total_xp).level}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="p-5" delay={140}>
        <PanelHead eyebrow="Secrets" title="Still hidden from you" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SECRETS.map((s) =>
            s.requiredLevel <= level ? (
              <div
                key={s.id}
                className="border-secret/40 bg-secret/[0.08] rounded-xl border p-4 text-center"
              >
                <p className="numeral text-secret text-xl">FOUND</p>
                <p className="text-foreground/85 mt-2 text-sm">{s.hint}</p>
                <p className="text-muted-foreground mt-2 font-mono text-[11px]">
                  Revealed at Level {s.requiredLevel}
                </p>
              </div>
            ) : (
              <LockedTile key={s.id} hint={s.hint} requirement={`Level ${s.requiredLevel}`} />
            ),
          )}
        </div>
      </Panel>
    </div>
  );
}
