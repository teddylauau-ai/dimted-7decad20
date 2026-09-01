import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Meter, Panel, PageHeader } from "@/components/dimted/primitives";
import { Avatar, Nametag, ProfileLink } from "@/components/dimted/Identity";
import { EFFECT_CLASS } from "@/lib/cosmetics";
import { useDimted } from "@/lib/dimted-store";
import { friendshipLevel } from "@/lib/dimted";
import { useDirectMessages, useFriendships, useRefreshDimted } from "@/lib/dimted-queries";
import { sendDirectMessage } from "@/lib/dimted-actions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — DIMTED" },
      {
        name: "description",
        content:
          "Direct messages in DIMTED raise your Level and your Friendship Level. Real replies count; spam does not.",
      },
      { property: "og:title", content: "Messages — DIMTED" },
      { property: "og:description", content: "Conversations are the game." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { profile, award } = useDimted();
  const friends = useFriendships(profile?.id);
  const refresh = useRefreshDimted();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const accepted = useMemo(
    () => (friends.data ?? []).filter((f) => f.status === "accepted"),
    [friends.data],
  );
  const active = accepted.find((f) => f.friendshipId === activeId) ?? accepted[0] ?? null;
  const messages = useDirectMessages(active?.friendshipId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !active || !profile) return;
    setDraft("");
    try {
      await sendDirectMessage(active.friendshipId, profile.id, body);
      await messages.refetch();
      const result = await award("message", `Message to ${active.profile.display_name}`);
      if (result === "capped") toast("Message XP is capped for this hour — keep talking anyway.");
      refresh();
    } catch {
      toast.error("Message didn't send");
    }
  }

  const fl = active ? friendshipLevel(active.friendshipXp) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Direct"
        title="Messages"
        blurb="Every real exchange feeds two ladders at once: your Level and this friendship."
      />

      {accepted.length === 0 ? (
        <Panel className="p-8 text-center">
          <p className="font-display text-lg font-semibold">No conversations yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            DIMTED has no pre-made friends. Find real accounts in Discover, send a request, and this
            page opens up.
          </p>
          <Button asChild className="mt-5">
            <Link to="/discover">Find people</Link>
          </Button>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <Panel className="p-3">
            <ul className="space-y-1">
              {accepted.map((f) => {
                const lvl = friendshipLevel(f.friendshipXp);
                const isActive = f.friendshipId === active?.friendshipId;
                return (
                  <li key={f.friendshipId}>
                    <button
                      onClick={() => setActiveId(f.friendshipId)}
                      className={cn(
                        "w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                        isActive ? "bg-secondary" : "hover:bg-secondary/60",
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <Avatar profile={f.profile} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <Nametag profile={f.profile} className="truncate text-sm" />
                            <span className="text-primary shrink-0 font-mono text-[10px]">
                              FL {lvl.level}
                            </span>
                          </span>
                          <span className="text-muted-foreground block truncate font-mono text-[10px]">
                            @{f.profile.username}
                          </span>
                        </span>
                      </span>
                      <Meter value={lvl.into / lvl.needed} tone="primary" className="mt-2 h-1" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel className="flex min-h-[560px] flex-col p-0" delay={60}>
            <header className="border-border flex items-center justify-between gap-4 border-b px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                {active ? <Avatar profile={active.profile} size={36} /> : null}
                <div className="min-w-0">
                {active ? (
                  <ProfileLink
                    profile={active.profile}
                    className="font-display truncate text-base font-semibold"
                  />
                ) : null}
                <p className="text-muted-foreground truncate text-xs">
                  {fl ? `${fl.name} · Friendship Level ${fl.level}` : ""}
                  {active?.streak ? ` · ${active.streak} day streak` : ""}
                </p>
                </div>
              </div>
              {fl ? (
                <div className="w-28 shrink-0">
                  <Meter value={fl.into / fl.needed} tone="gold" className="h-1.5" />
                  <p className="text-muted-foreground mt-1 text-right font-mono text-[10px]">
                    {fl.into}/{fl.needed}
                  </p>
                </div>
              ) : null}
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              {(messages.data ?? []).length === 0 ? (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  Say something first. The first message is worth XP to both of you.
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
                  return (
                    <div key={m.id} className={cn("chat-row group flex gap-3", grouped ? "mt-0" : "mt-3", fx)}>
                      {grouped ? (
                        <span className="text-muted-foreground/0 group-hover:text-muted-foreground/70 w-9 shrink-0 pt-0.5 text-right font-mono text-[9px]">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <Avatar profile={m.author} size={36} className="mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        {grouped ? null : (
                          <p className="flex items-baseline gap-2">
                            <ProfileLink profile={m.author} className="text-sm" />
                            <span className="text-muted-foreground font-mono text-[10px]">
                              {new Date(m.created_at).toLocaleString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
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
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="border-border flex gap-2 border-t px-5 py-4">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write something worth replying to…"
              />
              <Button type="submit" disabled={!draft.trim()}>
                <Send className="size-4" />
              </Button>
            </form>
          </Panel>
        </div>
      )}
    </div>
  );
}
