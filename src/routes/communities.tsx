import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Globe, Lock, Pencil, Pin, Plus, Send, Settings2, Trash2, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Meter, Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import { CallPanel } from "@/components/dimted/CallPanel";
import { Avatar, ProfileLink } from "@/components/dimted/Identity";
import { EFFECT_CLASS } from "@/lib/cosmetics";
import { COMMUNITY_UNLOCKS, communityLevel, nextCommunityUnlock } from "@/lib/dimted";
import {
  useChannelMessages,
  useChannels,
  useCommunities,
  useCommunityInvites,
  useCommunityMembers,
  useRefreshDimted,
} from "@/lib/dimted-queries";
import { useMyRole } from "@/lib/roles-queries";
import {
  createCommunityAdvanced,
  deleteCommunityAsStaff,
  deleteCommunityMessage,
  inviteToCommunity,
  joinCommunity,
  postChannelMessage,
  postChannelVoiceMessage,
  removeCommunityMember,
  revokeCommunityInvite,
  setCommunityVisibility,
} from "@/lib/dimted-actions";
import { VoicePlayer, VoiceRecorder } from "@/components/dimted/VoiceMessage";
import { Reactions } from "@/components/dimted/Reactions";
import { useReactions, useToggleReaction } from "@/lib/reactions";
import { TypingIndicator } from "@/components/dimted/TypingIndicator";
import { useTypingSignal, useTypingUsers } from "@/lib/typing";
import { ChatImage, ImagePicker, PinBanner } from "@/components/dimted/ChatExtras";
import {
  editCommunityMessage,
  pinnedMessageId,
  postChannelImageMessage,
  usePinMessage,
  usePinnedMessage,
  useUnpinMessage,
} from "@/lib/chat-extras";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/communities")({
  head: () => ({
    meta: [
      { title: "Communities — Lazu" },
      {
        name: "description",
        content:
          "Communities in Lazu level up from real participation, unlocking channels, roles and shared spaces.",
      },
      { property: "og:title", content: "Communities — Lazu" },
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
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [draft, setDraft] = useState("");
  const [managing, setManaging] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const { isStaff: isAdmin } = useMyRole(profile?.id);

  const rows = communities.data ?? [];
  const mine = rows.filter((c) => c.isMember);
  const active = mine.find((c) => c.id === activeId) ?? mine[0] ?? null;
  const channels = useChannels(active?.id);
  const [channelId, setChannelId] = useState<string | null>(null);
  const activeChannel = (channels.data ?? []).find((c) => c.id === channelId) ?? channels.data?.[0] ?? null;
  const messages = useChannelMessages(activeChannel?.id);
  const members = useCommunityMembers(active?.id);
  const invites = useCommunityInvites(active?.id);
  const canManage = !!active && !!profile && (active.owner_id === profile.id || isAdmin);

  useEffect(() => {
    setChannelId(null);
  }, [active?.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    try {
      const id = await createCommunityAdvanced(profile.id, name.trim(), tagline.trim(), visibility);
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

  const reactionIds = useMemo(() => (messages.data ?? []).map((m) => m.id), [messages.data]);
  const reactions = useReactions("community", activeChannel?.id ?? null, reactionIds);
  const toggleReaction = useToggleReaction("community", activeChannel?.id ?? null);
  const typingNames = useTypingUsers("channel", activeChannel?.id, profile?.id);
  const typing = useTypingSignal("channel", activeChannel?.id);
  const pin = usePinnedMessage("community", activeChannel?.id);
  const pinMut = usePinMessage("community", activeChannel?.id);
  const unpinMut = useUnpinMessage("community", activeChannel?.id);
  const pinnedId = pinnedMessageId(pin.data);
  const pinnedMsg = pinnedId ? (messages.data ?? []).find((m) => m.id === pinnedId) : undefined;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  async function saveEdit(id: string) {
    const body = editDraft.trim();
    if (!body) return;
    try {
      await editCommunityMessage(id, body);
      setEditingId(null);
      await messages.refetch();
    } catch {
      toast.error("Couldn't edit that message");
    }
  }

  async function postImage(file: File) {
    if (!profile || !active || !activeChannel) return;
    try {
      await postChannelImageMessage(active.id, activeChannel.id, profile.id, file, "");
      await messages.refetch();
      await award("community", `Image in #${activeChannel.name}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image didn't post");
    }
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !profile || !active || !activeChannel) return;
    setDraft("");
    typing.clear();
    try {
      await postChannelMessage(active.id, activeChannel.id, profile.id, body);
      await messages.refetch();
      await award("community", `Posted in #${activeChannel.name}`);
      refresh();
    } catch {
      toast.error("Message didn't post");
    }
  }

  async function postVoice(blob: Blob, ms: number) {
    if (!profile || !active || !activeChannel) return;
    await postChannelVoiceMessage(active.id, activeChannel.id, profile.id, blob, ms);
    await messages.refetch();
    await award("community", `Voice note in #${activeChannel.name}`);
    refresh();
  }

  async function toggleVisibility() {
    if (!active) return;
    try {
      await setCommunityVisibility(active.id, active.visibility === "private" ? "public" : "private");
      await communities.refetch();
      toast.success("Visibility updated");
    } catch {
      toast.error("Couldn't change visibility");
    }
  }

  async function removeCommunity() {
    if (!active) return;
    if (!confirm(`Delete ${active.name}? Every channel and message goes with it.`)) return;
    try {
      const res = await deleteCommunityAsStaff(active.id);
      if (res.status !== "ok") {
        toast.error("You can't delete that community");
        return;
      }
      setActiveId(null);
      setManaging(false);
      await communities.refetch();
      toast.success("Community deleted");
    } catch {
      toast.error("Couldn't delete that community");
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !profile) return;
    const handle = inviteName.trim().replace(/^@/, "").toLowerCase();
    if (!handle) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", handle)
        .maybeSingle();
      if (!data) {
        toast.error("No account with that username");
        return;
      }
      await inviteToCommunity(active.id, data.id, profile.id);
      setInviteName("");
      await invites.refetch();
      toast.success(`Invited @${handle}`);
    } catch {
      toast.error("Couldn't send that invite");
    }
  }

  async function revoke(userId: string) {
    if (!active) return;
    try {
      await revokeCommunityInvite(active.id, userId);
      await invites.refetch();
    } catch {
      toast.error("Couldn't revoke that invite");
    }
  }

  async function kick(userId: string) {
    if (!active) return;
    try {
      await removeCommunityMember(active.id, userId);
      await members.refetch();
      await communities.refetch();
      toast.success("Member removed");
    } catch {
      toast.error("Couldn't remove that member");
    }
  }

  async function removeMessage(id: string) {
    try {
      await deleteCommunityMessage(id);
      await messages.refetch();
    } catch {
      toast.error("Couldn't delete that message");
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
            <div className="glass-raised inline-flex rounded-full p-1">
              {(
                [
                  { id: "public", label: "Public", icon: Globe },
                  { id: "private", label: "Invite only", icon: Lock },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVisibility(v.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                    visibility === v.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <v.icon className="size-3.5" /> {v.label}
                </button>
              ))}
            </div>
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
              <span className="ml-auto flex items-center gap-2">
                {active?.visibility === "private" ? (
                  <span className="text-muted-foreground flex items-center gap-1 font-mono text-[10px]">
                    <Lock className="size-3" /> invite only
                  </span>
                ) : null}
                {canManage ? (
                  <Button size="sm" variant="ghost" onClick={() => setManaging((v) => !v)}>
                    <Settings2 className="size-3.5" /> Manage
                  </Button>
                ) : null}
              </span>
            </header>

            {activeChannel ? (
              <div className="border-border bg-background/30 border-b px-5 py-2">
                <CallPanel
                  scope="channel"
                  scopeId={activeChannel.id}
                  meId={profile?.id}
                  meProfile={profile as never}
                  lookup={(id) =>
                    ((messages.data ?? []).find((m) => m.author?.id === id)?.author as never) ?? null
                  }
                />
              </div>
            ) : null}

            {managing && canManage && active ? (
              <div className="border-border bg-background/40 space-y-4 border-b px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void toggleVisibility()}
                  >
                    {active.visibility === "private" ? (
                      <>
                        <Globe className="size-3.5" /> Make public
                      </>
                    ) : (
                      <>
                        <Lock className="size-3.5" /> Make invite only
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void removeCommunity()}>
                    <Trash2 className="size-3.5" /> Delete community
                  </Button>
                </div>

                <form onSubmit={invite} className="flex flex-wrap gap-2">
                  <Input
                    className="min-w-48 flex-1"
                    placeholder="Invite by @username"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                  <Button size="sm" type="submit" disabled={!inviteName.trim()}>
                    Invite
                  </Button>
                </form>

                {(invites.data ?? []).length > 0 ? (
                  <div>
                    <p className="eyebrow mb-2">Pending invites</p>
                    <ul className="flex flex-wrap gap-2">
                      {(invites.data ?? []).map((iv) => (
                        <li
                          key={iv.user_id}
                          className="border-border flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px]"
                        >
                          @{iv.profile?.username ?? "unknown"}
                          <button
                            type="button"
                            aria-label="Revoke invite"
                            onClick={() => void revoke(iv.user_id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <p className="eyebrow mb-2">Members · {(members.data ?? []).length}</p>
                  <ul className="space-y-1">
                    {(members.data ?? []).map((m) => (
                      <li key={m.user_id} className="flex items-center gap-2 text-sm">
                        <Avatar profile={m.profile} size={24} />
                        <ProfileLink profile={m.profile} className="text-sm" />
                        <span className="text-muted-foreground font-mono text-[10px]">{m.role}</span>
                        {m.user_id !== active.owner_id ? (
                          <button
                            type="button"
                            aria-label="Remove member"
                            onClick={() => void kick(m.user_id)}
                            className="text-muted-foreground hover:text-destructive ml-auto"
                          >
                            <UserMinus className="size-3.5" />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

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
                        {m.audio_url ? (
                          <VoicePlayer url={m.audio_url} ms={m.audio_ms} />
                        ) : (
                          <p className="text-foreground/95 text-sm leading-relaxed break-words">
                            {m.body}
                          </p>
                        )}
                        <Reactions
                          scope="community"
                          messageId={m.id}
                          tallies={reactions.data?.[m.id] ?? []}
                          onToggle={(emoji, mine) =>
                            toggleReaction.mutate({ messageId: m.id, emoji, mine })
                          }
                        />
                      </div>
                      {m.author?.id === profile?.id || canManage ? (
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
                  );
                })
              )}
            </div>

            <form onSubmit={post} className="border-border overflow-hidden border-t">
              <TypingIndicator names={typingNames} />
              <div className="flex gap-2 px-5 py-4">
                <VoiceRecorder onSend={postVoice} disabled={!activeChannel} />
                <Input
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (e.target.value.trim()) typing.signal();
                  }}
                  placeholder={activeChannel ? `Message #${activeChannel.name}` : "Pick a channel"}
                  disabled={!activeChannel}
                />
                <Button type="submit" disabled={!draft.trim() || !activeChannel}>
                  <Send className="size-4" />
                </Button>
              </div>
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
