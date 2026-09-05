import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, Lock, Plus, Send, Settings2, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import { Avatar, ProfileLink } from "@/components/dimted/Identity";
import {
  acceptCrewInvite,
  createCrew,
  fetchCrewInvites,
  fetchCrewMembers,
  fetchCrewMessages,
  fetchCrews,
  fetchMyCrewInvites,
  inviteToCrew,
  leaveCrew,
  postCrewImageMessage,
  postCrewMessage,
  postCrewVoiceMessage,
  promoteCrewMember,
  removeCrewMember,
  revokeCrewInvite,
  type CrewInvite,
  type CrewMember,
  type CrewMessage,
  type CrewRow,
} from "@/lib/crews";
import { useMyRole } from "@/lib/roles-queries";
import { VoicePlayer, VoiceRecorder } from "@/components/dimted/VoiceMessage";
import { ChatImage, ImagePicker, ReplyChip, ReplyQuote, findReplyTarget } from "@/components/dimted/ChatExtras";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/crews")({
  head: () => ({
    meta: [
      { title: "Crews — Lazu" },
      {
        name: "description",
        content: "Invite-only squads with shared XP, private chat, and crew-only cosmetics.",
      },
      { property: "og:title", content: "Crews — Lazu" },
      { property: "og:description", content: "Find your squad and climb together." },
    ],
  }),
  component: CrewsPage,
});

function CrewsPage() {
  const { profile, award } = useDimted();
  const { isStaff } = useMyRole(profile?.id);

  const crews = useQuery({
    queryKey: ["crews", profile?.id],
    enabled: !!profile?.id,
    queryFn: () => fetchCrews(profile!.id),
    refetchInterval: 5000,
  });

  const myInvites = useQuery({
    queryKey: ["crew-invites-me", profile?.id],
    enabled: !!profile?.id,
    queryFn: () => fetchMyCrewInvites(profile!.id),
    refetchInterval: 10000,
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CrewMessage | null>(null);
  const [managing, setManaging] = useState(false);
  const [inviteName, setInviteName] = useState("");

  const rows = crews.data ?? [];
  const mine = rows.filter((c) => c.isMember);
  const active = mine.find((c) => c.id === activeId) ?? mine[0] ?? null;

  const members = useQuery({
    queryKey: ["crew-members", active?.id],
    enabled: !!active?.id,
    queryFn: () => fetchCrewMembers(active!.id),
    refetchInterval: 5000,
  });

  const messages = useQuery({
    queryKey: ["crew-messages", active?.id],
    enabled: !!active?.id,
    queryFn: () => fetchCrewMessages(active!.id),
    refetchInterval: 4000,
  });

  const invites = useQuery({
    queryKey: ["crew-invites", active?.id],
    enabled: !!active?.id,
    queryFn: () => fetchCrewInvites(active!.id),
    refetchInterval: 10000,
  });

  const myRole = useMemo(() => {
    if (!active || !profile) return null;
    const m = (members.data ?? []).find((x) => x.user_id === profile.id);
    return m?.role ?? null;
  }, [active, members.data, profile]);

  const canManage = myRole === "owner" || myRole === "captain" || isStaff;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    try {
      const id = await createCrew(profile.id, name.trim(), tagline.trim(), visibility);
      setName("");
      setTagline("");
      setCreating(false);
      await crews.refetch();
      setActiveId(id);
      await award("discovery", "Founded a crew");
      toast.success("Crew created. Invite up to 24 more people.");
    } catch {
      toast.error("Couldn't create that crew");
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !profile || !inviteName.trim()) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", inviteName.trim().toLowerCase())
        .maybeSingle();
      if (!data) {
        toast.error("No user with that name");
        return;
      }
      await inviteToCrew(active.id, (data as { id: string }).id, profile.id);
      setInviteName("");
      await invites.refetch();
      toast.success("Invite sent");
    } catch {
      toast.error("Couldn't invite");
    }
  }

  async function acceptInvite(invite: CrewInvite) {
    try {
      await acceptCrewInvite(invite.crew_id);
      await myInvites.refetch();
      await crews.refetch();
      toast.success("You're in the crew");
    } catch {
      toast.error("Couldn't join");
    }
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !profile || !active) return;
    const replyingTo = replyTo;
    setDraft("");
    setReplyTo(null);
    try {
      await postCrewMessage(active.id, profile.id, body, replyingTo?.id ?? null);
      await messages.refetch();
      await award("message", "Crew chat");
    } catch {
      toast.error("Message didn't post");
    }
  }

  async function postVoice(blob: Blob, ms: number) {
    if (!profile || !active) return;
    await postCrewVoiceMessage(active.id, profile.id, blob, ms);
    await messages.refetch();
    await award("message", "Crew voice");
  }

  async function postImage(file: File) {
    if (!profile || !active) return;
    try {
      await postCrewImageMessage(active.id, profile.id, file);
      await messages.refetch();
      await award("message", "Crew image");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image didn't post");
    }
  }

  async function kick(member: CrewMember) {
    if (!active || !profile) return;
    try {
      await removeCrewMember(active.id, member.user_id);
      await members.refetch();
      toast.success("Member removed");
    } catch {
      toast.error("Couldn't remove");
    }
  }

  async function promote(member: CrewMember, role: "captain" | "member") {
    if (!active) return;
    try {
      await promoteCrewMember(active.id, member.user_id, role);
      await members.refetch();
      toast.success("Role updated");
    } catch {
      toast.error("Couldn't update role");
    }
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[500px] gap-3">
      {/* sidebar */}
      <aside className="glass flex w-64 shrink-0 flex-col rounded-2xl">
        <div className="flex items-center justify-between p-3">
          <PageHeader title="Crews" subtitle="Your squads" />
          <button onClick={() => setCreating(true)} className="text-primary hover:bg-secondary/60 grid size-8 place-items-center rounded-xl">
            <Plus className="size-4" />
          </button>
        </div>

        {creating && (
          <form onSubmit={create} className="space-y-2 p-3 pt-0">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Crew name" className="h-8 text-sm" />
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" className="h-8 text-sm" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setVisibility("public")} className={cn("flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-xs", visibility === "public" ? "bg-secondary text-foreground" : "text-muted-foreground")}>
                <Globe className="size-3" /> Public
              </button>
              <button type="button" onClick={() => setVisibility("private")} className={cn("flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-xs", visibility === "private" ? "bg-secondary text-foreground" : "text-muted-foreground")}>
                <Lock className="size-3" /> Private
              </button>
            </div>
            <Button type="submit" size="sm" className="w-full">Create</Button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto p-2 pt-0">
          <div className="space-y-1">
            {mine.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveId(c.id); setManaging(false); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors",
                  active?.id === c.id ? "bg-secondary text-foreground" : "hover:bg-secondary/50 text-muted-foreground"
                )}
              >
                <span className="text-lg">{c.badge_emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-muted-foreground truncate text-[10px]">{c.memberCount} members · {c.total_xp.toLocaleString()} XP</p>
                </div>
              </button>
            ))}
          </div>

          {(myInvites.data ?? []).length > 0 && (
            <div className="mt-4">
              <p className="eyebrow px-2">Invites</p>
              <div className="mt-1 space-y-1">
                {(myInvites.data ?? []).map((i) => (
                  <div key={i.id} className="flex items-center gap-2 rounded-xl bg-secondary/30 px-2 py-1.5">
                    <span className="text-sm">{i.crew?.badge_emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{i.crew?.name}</p>
                    </div>
                    <button onClick={() => acceptInvite(i)} className="text-primary text-[10px] font-semibold">Join</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* main */}
      <main className="glass flex min-w-0 flex-1 flex-col rounded-2xl">
        {!active ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <p className="text-lg font-semibold">No crew yet</p>
              <p className="text-muted-foreground text-sm">Create one or wait for an invite.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border/40 p-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{active.badge_emoji}</span>
                <div>
                  <p className="font-semibold leading-tight">{active.name}</p>
                  <p className="text-muted-foreground text-xs">{active.tagline || "No tagline"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <button onClick={() => setManaging((v) => !v)} className={cn("grid size-8 place-items-center rounded-xl", managing ? "bg-secondary" : "hover:bg-secondary/60")}>
                    <Settings2 className="size-4" />
                  </button>
                )}
              </div>
            </div>

            {managing ? (
              <div className="flex-1 overflow-y-auto p-4">
                <Panel>
                  <PanelHead title="Members" />
                  <div className="mt-2 space-y-2">
                    {(members.data ?? []).map((m) => (
                      <div key={m.user_id} className="flex items-center gap-2 rounded-xl bg-secondary/20 p-2">
                        <Avatar profile={m.profile as any} size={32} />
                        <div className="min-w-0 flex-1">
                          <ProfileLink username={m.profile.username} className="truncate text-sm font-medium hover:underline" />
                          <p className="text-muted-foreground text-[10px] capitalize">{m.role}</p>
                        </div>
                        {myRole === "owner" && m.user_id !== profile?.id && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => promote(m, m.role === "captain" ? "member" : "captain")} className="text-[10px] text-primary hover:underline">
                              {m.role === "captain" ? "Demote" : "Promote"}
                            </button>
                            <button onClick={() => kick(m)} className="text-destructive text-[10px] hover:underline">Remove</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel className="mt-3">
                  <PanelHead title="Invites" />
                  <form onSubmit={invite} className="mt-2 flex gap-2">
                    <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Username" className="h-8 text-sm" />
                    <Button type="submit" size="sm">Invite</Button>
                  </form>
                  <div className="mt-2 space-y-1">
                    {(invites.data ?? []).map((i) => (
                      <div key={i.id} className="flex items-center justify-between rounded-lg bg-secondary/20 px-2 py-1 text-xs">
                        <span className="truncate">{i.profile?.display_name || i.profile?.username}</span>
                        <button onClick={() => revokeCrewInvite(active.id, i.user_id).then(() => invites.refetch())} className="text-destructive hover:underline">Revoke</button>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {(messages.data ?? []).map((m) => (
                    <CrewChatRow
                      key={m.id}
                      message={m}
                      isMe={m.user_id === profile?.id}
                      onReply={() => setReplyTo(m)}
                    />
                  ))}
                </div>

                {replyTo && (
                  <div className="border-t border-border/40 px-3 pt-2">
                    <ReplyChip reply={replyTo} onClear={() => setReplyTo(null)} />
                  </div>
                )}

                <form onSubmit={post} className="flex items-end gap-2 p-3 pt-2">
                  <ImagePicker onImage={postImage} />
                  <VoiceRecorder onRecording={postVoice} />
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Message your crew..."
                    className="h-10 flex-1 text-sm"
                  />
                  <Button type="submit" size="icon" className="size-10 shrink-0">
                    <Send className="size-4" />
                  </Button>
                </form>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function CrewChatRow({
  message,
  isMe,
  onReply,
}: {
  message: CrewMessage;
  isMe: boolean;
  onReply: () => void;
}) {
  const a = message.author;
  return (
    <div className={cn("flex gap-2", isMe && "flex-row-reverse")}>
      <Avatar profile={a as any} size={34} />
      <div className={cn("max-w-[80%] rounded-2xl px-3 py-2", isMe ? "bg-primary text-primary-foreground" : "bg-secondary")}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold opacity-90">{a?.display_name || a?.username}</span>
          <span className="text-[10px] opacity-60">{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {message.reply_to_id && <ReplyQuote message={message as any} />}
        {message.image_url ? <ChatImage url={message.image_url} /> : <p className="whitespace-pre-wrap text-sm">{message.body}</p>}
        {message.audio_url && <VoicePlayer url={message.audio_url} durationMs={message.audio_ms ?? 0} />}
        <button onClick={onReply} className="mt-1 text-[10px] opacity-60 hover:opacity-100">Reply</button>
      </div>
    </div>
  );
}
