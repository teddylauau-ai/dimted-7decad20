import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Meter, Panel, PageHeader } from "@/components/dimted/primitives";
import { Avatar, Nametag, ProfileLink } from "@/components/dimted/Identity";
import { EFFECT_CLASS } from "@/lib/cosmetics";
import { useDimted } from "@/lib/dimted-store";
import { friendshipLevel } from "@/lib/dimted";
import { useDirectMessages, useFriendships, useRefreshDimted } from "@/lib/dimted-queries";
import {
  deleteDirectMessage,
  markConversationNotificationsRead,
  sendDirectMessage,
  sendDirectVoiceMessage,
} from "@/lib/dimted-actions";
import { useQueryClient } from "@tanstack/react-query";
import { VoicePlayer, VoiceRecorder } from "@/components/dimted/VoiceMessage";
import { TypingIndicator } from "@/components/dimted/TypingIndicator";
import { useTypingSignal, useTypingUsers } from "@/lib/typing";
import { useMyRole } from "@/lib/roles-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Lazu" },
      {
        name: "description",
        content:
          "Direct messages in Lazu raise your Level and your Friendship Level. Real replies count; spam does not.",
      },
      { property: "og:title", content: "Messages — Lazu" },
      { property: "og:description", content: "Conversations are the game." },
    ],
  }),
  component: MessagesPage,
});

/** "3m", "2h", "4d" — compact recency for the conversation list. */
function ago(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - Date.parse(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function MessagesPage() {
  const { profile, award } = useDimted();
  const friends = useFriendships(profile?.id);
  const refresh = useRefreshDimted();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const { isModerator } = useMyRole(profile?.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Most recently active conversation first — that's the one you land in. */
  const accepted = useMemo(
    () =>
      (friends.data ?? [])
        .filter((f) => f.status === "accepted")
        .slice()
        .sort(
          (a, b) =>
            Date.parse(b.lastExchangeAt ?? "1970-01-01") -
            Date.parse(a.lastExchangeAt ?? "1970-01-01"),
        ),
    [friends.data],
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return accepted;
    return accepted.filter(
      (f) =>
        f.profile.display_name.toLowerCase().includes(q) ||
        f.profile.username.toLowerCase().includes(q),
    );
  }, [accepted, filter]);

  const active = accepted.find((f) => f.friendshipId === activeId) ?? accepted[0] ?? null;
  const messages = useDirectMessages(active?.friendshipId);
  const typingNames = useTypingUsers("dm", active?.friendshipId, profile?.id);
  const typing = useTypingSignal("dm", active?.friendshipId);

  // Open the most recent chat automatically the first time the page loads.
  useEffect(() => {
    if (!activeId && accepted[0]) setActiveId(accepted[0].friendshipId);
  }, [accepted, activeId]);

  const qc = useQueryClient();
  // Opening a conversation clears that person's unread message pings — the red
  // nav badge and the (n) tab-title count go away together.
  const activeProfileId = active?.profile.id;
  const messageCount = messages.data?.length ?? 0;
  useEffect(() => {
    if (!activeProfileId) return;
    markConversationNotificationsRead(activeProfileId)
      .then(() => qc.invalidateQueries({ queryKey: ["notifications"] }))
      .catch(() => {});
  }, [activeProfileId, qc, messageCount]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !active || !profile) return;
    setDraft("");
    typing.clear();
    try {
      await sendDirectMessage(active.friendshipId, profile.id, body);
      await messages.refetch();
      await award("message", `Message to ${active.profile.display_name}`);
      refresh();
    } catch {
      toast.error("Message didn't send");
    }
  }

  async function sendVoice(blob: Blob, ms: number) {
    if (!active || !profile) return;
    await sendDirectVoiceMessage(active.friendshipId, profile.id, blob, ms);
    await messages.refetch();
    await award("message", `Voice message to ${active.profile.display_name}`);
    refresh();
  }

  const fl = active ? friendshipLevel(active.friendshipXp) : null;

  async function removeMessage(id: string) {
    try {
      await deleteDirectMessage(id);
      await messages.refetch();
    } catch {
      toast.error("Couldn't delete that message");
    }
  }

  const list = messages.data ?? [];

  // Keep the chat pinned to the bottom as new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length, activeId]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Direct"
        title="Messages"
        blurb="Newest message drops to the bottom like a normal chat. Chats keep their latest 100 messages, so nothing ever bogs down."
      />

      {accepted.length === 0 ? (
        <Panel className="p-8 text-center">
          <p className="font-display text-lg font-semibold">No conversations yet</p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
            Lazu has no pre-made friends. Find real accounts in Discover, send a request, and this
            page opens up.
          </p>
          <Button asChild className="mt-5">
            <Link to="/discover">Find people</Link>
          </Button>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[276px_1fr]">
          <Panel className="p-3">
            <div className="relative mb-2">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a conversation"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <ul className="space-y-1">
              {visible.map((f) => {
                const lvl = friendshipLevel(f.friendshipXp);
                const isActive = f.friendshipId === active?.friendshipId;
                return (
                  <li key={f.friendshipId}>
                    <button
                      onClick={() => setActiveId(f.friendshipId)}
                      className={cn(
                        "relative w-full rounded-xl px-3 py-2.5 text-left transition-colors",
                        isActive ? "bg-secondary" : "hover:bg-secondary/60",
                      )}
                    >
                      {isActive ? (
                        <span className="bg-primary absolute top-1/2 left-0 h-7 w-[3px] -translate-y-1/2 rounded-r-full" />
                      ) : null}
                      <span className="flex items-center gap-2.5">
                        <Avatar profile={f.profile} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <Nametag profile={f.profile} className="truncate text-sm" />
                            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                              {ago(f.lastExchangeAt)}
                            </span>
                          </span>
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-muted-foreground truncate font-mono text-[10px]">
                              @{f.profile.username}
                            </span>
                            <span className="text-primary shrink-0 font-mono text-[10px]">
                              FL {lvl.level}
                            </span>
                          </span>
                        </span>
                      </span>
                      <Meter value={lvl.into / lvl.needed} tone="primary" className="mt-2 h-1" />
                    </button>
                  </li>
                );
              })}
              {visible.length === 0 ? (
                <li className="text-muted-foreground px-3 py-6 text-center text-xs">
                  Nobody matches that.
                </li>
              ) : null}
            </ul>
          </Panel>

          <Panel className="flex h-[620px] flex-col p-0" delay={60}>
            <header className="border-border bg-secondary/25 flex items-center justify-between gap-4 border-b px-5 py-4">
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

            {/* Oldest first: the chat scrolls up like Discord/iMessage. */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4">
              {list.length === 0 ? (
                <p className="text-muted-foreground py-10 text-center text-sm">
                  Say something first. The first message is worth XP to both of you.
                </p>
              ) : (
                list.map((m, i) => {
                  const previous = list[i - 1];
                  const grouped =
                    !!previous &&
                    previous.author?.id === m.author?.id &&
                    Date.parse(m.created_at) - Date.parse(previous.created_at) < 5 * 60 * 1000 &&
                    new Date(previous.created_at).toDateString() ===
                      new Date(m.created_at).toDateString();
                  const fx = m.author?.equipped_effect
                    ? EFFECT_CLASS[m.author.equipped_effect]
                    : undefined;
                  const dayStarts =
                    !previous ||
                    new Date(previous.created_at).toDateString() !==
                      new Date(m.created_at).toDateString();
                  const mine = m.author?.id === profile?.id;
                  return (
                    <div key={m.id}>
                      {dayStarts ? (
                        <div className="my-4 flex items-center gap-3">
                          <span className="bg-border h-px flex-1" />
                          <span className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
                            {new Date(m.created_at).toLocaleDateString([], {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="bg-border h-px flex-1" />
                        </div>
                      ) : null}
                      <div
                        className={cn(
                          "chat-row group hover:bg-secondary/35 flex gap-3 rounded-lg px-2 py-1 transition-colors",
                          grouped ? "mt-0" : "mt-3",
                          fx,
                        )}
                      >
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
                              {mine ? null : (
                                <span className="text-muted-foreground/70 font-mono text-[10px]">
                                  @{m.author?.username}
                                </span>
                              )}
                            </p>
                          )}
                          {m.audio_url ? (
                            <VoicePlayer url={m.audio_url} ms={m.audio_ms} />
                          ) : (
                            <p className="text-foreground/95 text-sm leading-relaxed break-words">
                              {m.body}
                            </p>
                          )}
                        </div>
                        {mine || isModerator ? (
                          <button
                            type="button"
                            aria-label="Delete message"
                            onClick={() => void removeMessage(m.id)}
                            className="text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive shrink-0 self-start pt-1"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
              {list.length >= 100 ? (
                <p className="text-muted-foreground/70 py-4 text-center font-mono text-[10px] tracking-[0.16em] uppercase">
                  Older messages are cleared automatically
                </p>
              ) : null}
            </div>

            <form
              onSubmit={send}
              className="border-border bg-secondary/15 overflow-hidden border-t"
            >
              <TypingIndicator names={typingNames} />
              <div className="flex gap-2 px-5 py-3">
                <VoiceRecorder onSend={sendVoice} disabled={!active} />
                <Input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (e.target.value.trim()) typing.signal();
                  }}
                  placeholder="Write something worth replying to…"
                />
                <Button type="submit" disabled={!draft.trim()}>
                  <Send className="size-4" />
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </div>
  );
}
