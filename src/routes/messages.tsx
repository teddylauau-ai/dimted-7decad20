import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Meter, Panel, PageHeader } from "@/components/dimted/primitives";
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
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{f.profile.display_name}</span>
                        <span className="text-primary shrink-0 font-mono text-[10px]">
                          FL {lvl.level}
                        </span>
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        @{f.profile.username}
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
              <div className="min-w-0">
                <p className="font-display truncate text-base font-semibold">
                  {active?.profile.display_name}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {fl ? `${fl.name} · Friendship Level ${fl.level}` : ""}
                  {active?.streak ? ` · ${active.streak} day streak` : ""}
                </p>
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

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {(messages.data ?? []).length === 0 ? (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  Say something first. The first message is worth XP to both of you.
                </p>
              ) : (
                (messages.data ?? []).map((m) => {
                  const mine = m.author?.id === profile?.id;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "animate-pop-in max-w-[76%] rounded-2xl px-4 py-2.5 text-sm",
                          mine
                            ? "bg-primary/15 border-primary/25 border"
                            : "bg-secondary border-border border",
                        )}
                      >
                        <p className="leading-relaxed">{m.body}</p>
                        <p className="text-muted-foreground mt-1 font-mono text-[10px]">
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
