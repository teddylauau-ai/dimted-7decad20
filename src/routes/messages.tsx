import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CONVERSATIONS, FRIENDS, friendshipLevel } from "@/lib/dimted";
import { useDimted } from "@/lib/dimted-store";
import { Meter, Panel, PageHeader, RarityChip } from "@/components/dimted/primitives";
import { rarityDot } from "@/components/dimted/rarity";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — DIMTED" },
      {
        name: "description",
        content:
          "DMs where conversations become progression: friendship levels, conversation milestones and chat cosmetics unlocked by talking.",
      },
      { property: "og:title", content: "Messages — DIMTED" },
      { property: "og:description", content: "Conversations that raise friendship levels and unlock shared rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

type Msg = { from: "me" | "them"; text: string; at: string };

function MessagesPage() {
  const { award, level } = useDimted();
  const [activeId, setActiveId] = useState(CONVERSATIONS[0]!.id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Record<string, Msg[]>>({});

  const conversation = CONVERSATIONS.find((c) => c.id === activeId)!;
  const friend = FRIENDS.find((f) => f.id === conversation.friendId)!;
  const bond = friendshipLevel(friend.friendshipXp);
  const messages: Msg[] = [...conversation.messages, ...(extra[activeId] ?? [])];
  const draft = drafts[activeId] ?? "";

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setExtra((prev) => ({
      ...prev,
      [activeId]: [
        ...(prev[activeId] ?? []),
        { from: "me", text, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ],
    }));
    setDrafts((prev) => ({ ...prev, [activeId]: "" }));
    const result = award("message", 4, `message to ${friend.name.split(" ")[0]}`);
    if (result === "cooldown") {
      toast("No XP for that one — one reward per minute, per conversation.");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Messages"
        title="Chat is the progression"
        blurb="Every real exchange raises a friendship. Milestones unlock things you keep."
      />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Panel className="p-3">
          <ul className="space-y-1">
            {CONVERSATIONS.map((c) => {
              const f = FRIENDS.find((x) => x.id === c.friendId)!;
              const b = friendshipLevel(f.friendshipXp);
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "hover:bg-secondary/50 w-full rounded-xl px-3 py-3 text-left transition-colors",
                      activeId === c.id && "bg-secondary",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn("numeral text-primary-foreground grid size-9 shrink-0 place-items-center rounded-xl text-sm", rarityDot[f.accent])}>
                        {f.name[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{f.name}</p>
                          {f.online ? <span className="bg-uncommon size-1.5 rounded-full" /> : null}
                        </div>
                        <p className="text-muted-foreground truncate text-xs">{f.lastMessage}</p>
                      </div>
                      {f.unread ? (
                        <span className="bg-primary/15 text-primary rounded-full px-2 font-mono text-[10px]">
                          {f.unread}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Meter value={b.into / b.needed} className="h-1 flex-1" tone="primary" />
                      <span className="text-muted-foreground/70 font-mono text-[10px]">FL {b.level}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="flex min-h-[560px] flex-col p-0" delay={80}>
          <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">{friend.name}</h2>
              <p className="text-muted-foreground font-mono text-[11px]">
                Lv {friend.level} · {friend.title} · {friend.online ? "online" : "away"}
              </p>
            </div>
            <div className="text-right">
              <p className="eyebrow">Friendship</p>
              <p className="font-display text-sm">
                Level {bond.level} · <span className="text-primary">{bond.name}</span>
              </p>
              <Meter value={bond.into / bond.needed} className="mt-1.5 h-1.5 w-40" tone="xp" />
            </div>
          </header>

          {conversation.milestone ? (
            <div className="border-border bg-gold/[0.07] flex items-center gap-3 border-b px-5 py-3">
              <Sparkles className="text-gold size-4 shrink-0" strokeWidth={1.75} />
              <p className="min-w-0 flex-1 text-sm">{conversation.milestone}</p>
              <RarityChip rarity="uncommon" />
            </div>
          ) : null}

          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "animate-rise max-w-[76%] rounded-2xl px-4 py-2.5 text-sm",
                    m.from === "me"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md",
                  )}
                >
                  <p>{m.text}</p>
                  <p
                    className={cn(
                      "mt-1 font-mono text-[10px]",
                      m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground",
                    )}
                  >
                    {m.at}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-border border-t p-4">
            <div className="border-border bg-background/50 flex items-end gap-2 rounded-2xl border p-2">
              <textarea
                value={draft}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [activeId]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder={`Message ${friend.name.split(" ")[0]}…`}
                className="placeholder:text-muted-foreground/70 max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none"
              />
              <Button size="icon" onClick={send} aria-label="Send message" className="shrink-0">
                <Send className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground/70 mt-2 font-mono text-[10px]">
              {level >= 12 ? "Chat effects unlocked · Level 12" : "Chat effects unlock at Level 12"} · XP is capped per
              conversation
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
