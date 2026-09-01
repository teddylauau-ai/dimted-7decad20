import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Meter, Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import { Avatar, ProfileLink } from "@/components/dimted/Identity";
import { EFFECT_CLASS } from "@/lib/cosmetics";
import { COMMUNITY_UNLOCKS, communityLevel, nextCommunityUnlock } from "@/lib/dimted";
import {
  useChannelMessages,
  useChannels,
  useCommunities,
  useRefreshDimted,
} from "@/lib/dimted-queries";
import { createCommunity, joinCommunity, postChannelMessage } from "@/lib/dimted-actions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/communities")({
  head: () => ({
    meta: [
      { title: "Communities — DIMTED" },
      {
        name: "description",
        content:
          "Communities in DIMTED level up from real participation, unlocking channels, roles and shared spaces.",
      },
      { property: "og:title", content: "Communities — DIMTED" },
      { property: "og:description", content: "Communities have their own progression." },
    ],
  }),
  component: CommunitiesPage,
});

function CommunitiesPage() {
  const { profile, award } = useDimted();
  const communities = useCommunities(profile?.id);
  const refresh = useRefreshDimted();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [draft, setDraft] = useState("");

  const rows = communities.data ?? [];
  const mine = rows.filter((c) => c.isMember);
  const active = mine.find((c) => c.id === activeId) ?? mine[0] ?? null;
  const channels = useChannels(active?.id);
  const [channelId, setChannelId] = useState<string | null>(null);
  const activeChannel = (channels.data ?? []).find((c) => c.id === channelId) ?? channels.data?.[0] ?? null;
  const messages = useChannelMessages(activeChannel?.id);

  useEffect(() => {
    setChannelId(null);
  }, [active?.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    try {
      const id = await createCommunity(profile.id, name.trim(), tagline.trim());
      setName("");
      setTagline("");
      setCreating(false);
      await communities.refetch();
      setActiveId(id);
      await award("community", "Founded a community");
      refresh();
      toast.success("Community created. It starts at Level 1 too.");
    } catch {
      toast.error("Couldn't create that community");
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

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !profile || !active || !activeChannel) return;
    setDraft("");
    try {
      await postChannelMessage(active.id, activeChannel.id, profile.id, body);
      await messages.refetch();
      const result = await award("community", `Posted in #${activeChannel.name}`);
      if (result === "capped") toast("Community XP is capped for today.");
      refresh();
    } catch {
      toast.error("Message didn't post");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Shared"
        title="Communities"
        blurb="A community earns its own XP from the people in it. Levels unlock channels, roles and space."
        aside={
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            <Plus className="size-3.5" /> New community
          </Button>
        }
      />

      {creating ? (
        <Panel className="p-5">
          <PanelHead eyebrow="Found one" title="Create a community" />
          <form onSubmit={create} className="mt-4 flex flex-wrap gap-3">
            <Input
              className="min-w-48 flex-1"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              className="min-w-48 flex-1"
              placeholder="Tagline (optional)"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
            <Button type="submit">Create</Button>
          </form>
        </Panel>
      ) : null}

      {mine.length === 0 ? (
        <Panel className="p-8 text-center">
          <p className="font-display text-lg font-semibold">You're not in a community yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            Create one, or join a real one below. There are no seeded servers here.
          </p>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="space-y-3">
            {mine.map((c) => {
              const lvl = communityLevel(c.total_xp);
              const next = nextCommunityUnlock(lvl.level);
              const isActive = c.id === active?.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "glass w-full rounded-2xl p-4 text-left transition-colors",
                    isActive && "border-primary/40 ring-primary/25 ring-1",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className="text-primary shrink-0 font-mono text-[10px]">Lv {lvl.level}</span>
                  </div>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {c.tagline ?? `${c.memberCount} member${c.memberCount === 1 ? "" : "s"}`}
                  </p>
                  <Meter value={lvl.into / lvl.needed} tone="primary" className="mt-3 h-1.5" />
                  {next ? (
                    <p className="text-muted-foreground mt-2 text-[11px]">
                      Lv {next.level} · {next.name}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          <Panel className="flex min-h-[560px] flex-col p-0" delay={60}>
            <header className="border-border flex flex-wrap items-center gap-2 border-b px-5 py-4">
              {(channels.data ?? []).map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setChannelId(ch.id)}
                  className={cn(
                    "rounded-full px-3 py-1 font-mono text-xs transition-colors",
                    ch.id === activeChannel?.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  #{ch.name}
                </button>
              ))}
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              {(messages.data ?? []).length === 0 ? (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  Empty channel. The first post earns community XP for everyone.
                </p>
              ) : (
                (messages.data ?? []).map((m, i, list) => {
                  const prev = list[i - 1];
                  const grouped =
                    !!prev &&
                    prev.author?.id === m.author?.id &&
                    Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60 * 1000;
                  const fx = m.author?.equipped_effect
                    ? EFFECT_CLASS[m.author.equipped_effect]
                    : undefined;
                  const time = new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={m.id}
                      className={`chat-row group flex gap-3 ${grouped ? "mt-0" : "mt-3"} ${fx ?? ""}`}
                    >
                      {grouped ? (
                        <span className="text-muted-foreground/0 group-hover:text-muted-foreground/70 w-9 shrink-0 pt-0.5 text-right font-mono text-[9px]">
                          {time}
                        </span>
                      ) : (
                        <Avatar profile={m.author} size={36} className="mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        {grouped ? null : (
                          <p className="flex items-baseline gap-2">
                            <ProfileLink profile={m.author} className="text-sm" />
                            <span className="text-muted-foreground font-mono text-[10px]">{time}</span>
                          </p>
                        )}
                        <p className="text-foreground/95 text-sm leading-relaxed break-words">
                          {m.body}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={post} className="border-border flex gap-2 border-t px-5 py-4">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={activeChannel ? `Message #${activeChannel.name}` : "Pick a channel"}
                disabled={!activeChannel}
              />
              <Button type="submit" disabled={!draft.trim() || !activeChannel}>
                <Send className="size-4" />
              </Button>
            </form>
          </Panel>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <PanelHead eyebrow="Open" title="Communities to join" />
          {rows.filter((c) => !c.isMember).length === 0 ? (
            <p className="text-muted-foreground mt-4 text-sm">
              Nobody else has created a community yet. Be first.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {rows
                .filter((c) => !c.isMember)
                .map((c) => {
                  const lvl = communityLevel(c.total_xp);
                  return (
                    <li
                      key={c.id}
                      className="border-border bg-background/40 flex items-center gap-3 rounded-xl border p-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          Lv {lvl.level} · {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
                        </span>
                      </span>
                      <Button size="sm" variant="outline" onClick={() => void join(c.id)}>
                        Join
                      </Button>
                    </li>
                  );
                })}
            </ul>
          )}
        </Panel>

        <Panel className="p-5" delay={60}>
          <PanelHead eyebrow="Community ladder" title="What community levels unlock" />
          <ul className="mt-4 space-y-2">
            {COMMUNITY_UNLOCKS.map((u) => (
              <li
                key={u.level}
                className="border-border bg-background/40 flex items-center gap-3 rounded-xl border p-3"
              >
                <span className="numeral text-muted-foreground w-8 shrink-0 text-lg">{u.level}</span>
                <span className="flex-1 text-sm">{u.name}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
