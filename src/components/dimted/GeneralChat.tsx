import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Check, Globe2, Pencil, Reply, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/dimted/primitives";
import { Avatar, ProfileLink } from "@/components/dimted/Identity";
import { VoicePlayer, VoiceRecorder } from "@/components/dimted/VoiceMessage";
import { ChatImage, ImagePicker, ReplyChip, ReplyQuote, findReplyTarget } from "@/components/dimted/ChatExtras";
import { EFFECT_CLASS } from "@/lib/cosmetics";
import { useDimted } from "@/lib/dimted-store";
import { useMyRole } from "@/lib/roles-queries";
import type { ChatMessage } from "@/lib/dimted-queries";
import {
  deleteGeneralMessage,
  editGeneralMessage,
  sendGeneralImageMessage,
  sendGeneralMessage,
  sendGeneralVoiceMessage,
  useGeneralMessages,
} from "@/lib/general-chat";
import { cn } from "@/lib/utils";

/** The one shared room: every member of Lazu talks here. */
export function GeneralChat() {
  const { profile, award } = useDimted();
  const { isModerator } = useMyRole(profile?.id);
  const messages = useGeneralMessages(!!profile);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const list = useMemo(() => messages.data ?? [], [messages.data]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !profile) return;
    const replying = replyTo;
    setDraft("");
    setReplyTo(null);
    try {
      await sendGeneralMessage(profile.id, body, replying?.id ?? null);
      await messages.refetch();
      await award("message", "Posted in General");
    } catch {
      toast.error("Message didn't send");
    }
  }

  async function sendVoice(blob: Blob, ms: number) {
    if (!profile) return;
    await sendGeneralVoiceMessage(profile.id, blob, ms);
    await messages.refetch();
    await award("message", "Voice note in General");
  }

  async function sendImage(file: File) {
    if (!profile) return;
    try {
      await sendGeneralImageMessage(profile.id, file);
      await messages.refetch();
      await award("message", "Image in General");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image didn't send");
    }
  }

  async function saveEdit(id: string) {
    const body = editDraft.trim();
    if (!body) return;
    try {
      await editGeneralMessage(id, body);
      setEditingId(null);
      await messages.refetch();
    } catch {
      toast.error("Couldn't edit that message");
    }
  }

  async function remove(id: string) {
    try {
      await deleteGeneralMessage(id);
      await messages.refetch();
    } catch {
      toast.error("Couldn't delete that message");
    }
  }

  return (
    <Panel className="flex h-[620px] flex-col p-0" delay={60}>
      <header className="border-border bg-secondary/25 flex items-center justify-between gap-4 border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="bg-primary/15 text-primary flex size-9 items-center justify-center rounded-full">
            <Globe2 className="size-4" />
          </span>
          <div>
            <p className="font-display text-base font-semibold">General</p>
            <p className="text-muted-foreground text-xs">
              Everyone on Lazu. Latest 200 messages are kept.
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        }}
        className="relative flex-1 overflow-y-auto px-3 py-4"
      >
        {list.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            General is quiet. Say hello — it's worth XP.
          </p>
        ) : (
          list.map((m, i) => {
            const previous = list[i - 1];
            const grouped =
              !!previous &&
              previous.author?.id === m.author?.id &&
              Date.parse(m.created_at) - Date.parse(previous.created_at) < 5 * 60 * 1000;
            const dayStarts =
              !previous ||
              new Date(previous.created_at).toDateString() !== new Date(m.created_at).toDateString();
            const fx = m.author?.equipped_effect ? EFFECT_CLASS[m.author.equipped_effect] : undefined;
            const mine = m.author?.id === profile?.id;
            return (
              <div key={m.id} id={`gmsg-${m.id}`} className="rounded-lg transition-colors duration-500">
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
                    {m.reply_to_id ? (
                      <ReplyQuote
                        target={findReplyTarget(list, m)}
                        onJump={(id) => {
                          const el = document.getElementById(`gmsg-${id}`);
                          el?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                      />
                    ) : null}
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
                    {m.audio_url ? (
                      <VoicePlayer url={m.audio_url} ms={m.audio_ms} />
                    ) : m.image_url ? (
                      <ChatImage src={m.image_url} alt={`Image from ${m.author?.display_name ?? "chat"}`} />
                    ) : editingId === m.id ? (
                      <form
                        className="mt-1 flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void saveEdit(m.id);
                        }}
                      >
                        <Input
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button type="submit" size="icon" variant="ghost" className="h-8 w-8">
                          <Check className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="size-4" />
                        </Button>
                      </form>
                    ) : (
                      <p className="text-foreground/95 text-sm leading-relaxed break-words">
                        {m.body}
                        {m.edited_at ? (
                          <span className="text-muted-foreground/60 ml-1.5 font-mono text-[10px]">
                            (edited)
                          </span>
                        ) : null}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-0.5 self-start pt-1">
                    <button
                      type="button"
                      aria-label="Reply to message"
                      title="Reply"
                      onClick={() => setReplyTo(m)}
                      className="text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-primary rounded p-0.5"
                    >
                      <Reply className="size-3.5" />
                    </button>
                    {mine && !m.audio_url && !m.image_url ? (
                      <button
                        type="button"
                        aria-label="Edit message"
                        title="Edit message"
                        onClick={() => {
                          setEditingId(m.id);
                          setEditDraft(m.body);
                        }}
                        className="text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground rounded p-0.5"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    ) : null}
                    {mine || isModerator ? (
                      <button
                        type="button"
                        aria-label="Delete message"
                        title="Delete message"
                        onClick={() => void remove(m.id)}
                        className="text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive rounded p-0.5"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {atBottom ? null : (
        <button
          type="button"
          onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
          className="glass-raised text-foreground mx-auto -mt-9 mb-1 flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] shadow-lg"
        >
          <ArrowDown className="size-3.5" /> Jump to latest
        </button>
      )}

      <form onSubmit={send} className="border-border bg-secondary/15 overflow-hidden border-t">
        {replyTo ? <ReplyChip target={replyTo} onCancel={() => setReplyTo(null)} /> : null}
        <div className="flex gap-2 px-5 py-3">
          <ImagePicker onPick={sendImage} />
          <VoiceRecorder onSend={sendVoice} />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say something to everyone…"
          />
          <Button type="submit" disabled={!draft.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </Panel>
  );
}
