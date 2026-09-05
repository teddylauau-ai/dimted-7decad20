import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Compass, Globe, ImagePlus, Lock, LogOut, Plus, Send, Settings2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Panel, PanelHead } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import { Avatar, ProfileLink } from "@/components/dimted/Identity";
import {
  CREW_ACCENTS,
  CREW_EMOJI,
  accentOf,
  acceptCrewInvite,
  createCrew,
  crewLevel,
  fetchCrewInvites,
  fetchCrewMembers,
  fetchCrewMessages,
  fetchCrews,
  fetchMyCrewInvites,
  inviteToCrew,
  joinCrew,
  leaveCrew,
  postCrewImageMessage,
  postCrewMessage,
  postCrewVoiceMessage,
  promoteCrewMember,
  removeCrewMember,
  revokeCrewInvite,
  updateCrew,
  uploadCrewBanner,
  type CrewAccent,
  type CrewInvite,
  type CrewMember,
  type CrewMessage,
  type CrewRow,
} from "@/lib/crews";
import { useMyRole } from "@/lib/roles-queries";
import { VoicePlayer, VoiceRecorder } from "@/components/dimted/VoiceMessage";
import { ChatImage, ImagePicker, ReplyChip, ReplyQuote } from "@/components/dimted/ChatExtras";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/crews")({
  head: () => ({
    meta: [
      { title: "Crews — Lazu" },
      {
        name: "description",
        content: "Build a custom crew: shared XP pool, private chat, crew banners, badges and ranks.",
      },
      { property: "og:title", content: "Crews — Lazu" },
      { property: "og:description", content: "Find your squad and climb together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrewsPage,
});

type Tab = "chat" | "roster" | "settings" | "discover";

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
  const [tab, setTab] = useState<Tab>("chat");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CrewMessage | null>(null);
  const [inviteName, setInviteName] = useState("");

  const rows = crews.data ?? [];
  const mine = rows.filter((c) => c.isMember);
  const active = mine.find((c) => c.id === activeId) ?? mine[0] ?? null;
  const discoverable = rows.filter((c) => !c.isMember && c.visibility === "public");

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
    return (members.data ?? []).find((x) => x.user_id === profile.id)?.role ?? null;
  }, [active, members.data, profile]);

  const canManage = myRole === "owner" || myRole === "captain" || isStaff;

  async function handleJoin(crew: CrewRow) {
    try {
      await joinCrew(crew.id);
      await crews.refetch();
      await myInvites.refetch();
      setActiveId(crew.id);
      setTab("chat");
      toast.success(`Joined ${crew.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join");
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !profile || !inviteName.trim()) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", inviteName.trim().toLowerCase().replace(/^@/, ""))
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

  async function acceptInvite(inv: CrewInvite) {
    try {
      await acceptCrewInvite(inv.crew_id);
      await myInvites.refetch();
      await crews.refetch();
      setActiveId(inv.crew_id);
      toast.success("You're in the crew");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join");
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
    if (!active) return;
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

  async function leave() {
    if (!active || !profile) return;
    if (myRole === "owner") {
      toast.error("Owners can't leave — hand over the crew first");
      return;
    }
    try {
      await leaveCrew(active.id, profile.id);
      setActiveId(null);
      await crews.refetch();
      toast.success("You left the crew");
    } catch {
      toast.error("Couldn't leave");
    }
  }

  const accent = accentOf(active?.accent);
  const lvl = crewLevel(active?.total_xp ?? 0);

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[520px] gap-3">
      {/* sidebar */}
      <aside className="glass flex w-64 shrink-0 flex-col rounded-2xl">
        <div className="flex items-center justify-between p-3">
          <PanelHead title="Crews" />
          <button
            onClick={() => setCreating((v) => !v)}
            aria-label="Create a crew"
            className="text-primary hover:bg-secondary/60 grid size-8 place-items-center rounded-xl"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {creating && (
          <div className="px-3 pb-3">
            <CreateCrewForm
              onCancel={() => setCreating(false)}
              onCreated={async (id) => {
                setCreating(false);
                await crews.refetch();
                setActiveId(id);
                setTab("settings");
                await award("discovery", "Founded a crew");
                toast.success("Crew created — customise it and invite your people.");
              }}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 pt-0">
          <div className="space-y-1">
            {mine.map((c) => {
              const a = accentOf(c.accent);
              const cl = crewLevel(c.total_xp);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveId(c.id);
                    setTab("chat");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors",
                    active?.id === c.id ? "bg-secondary text-foreground" : "hover:bg-secondary/50 text-muted-foreground",
                  )}
                >
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", a.ring, "bg-secondary/50")}>
                    <span className="text-base">{c.badge_emoji}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-muted-foreground truncate text-[10px]">
                      Lv {cl.level} · {c.memberCount}/{c.member_limit}
                    </p>
                  </div>
                </button>
              );
            })}
            {mine.length === 0 && !creating && (
              <p className="text-muted-foreground px-2 py-3 text-xs">No crews yet — create one or join a public crew.</p>
            )}
          </div>

          <button
            onClick={() => setTab("discover")}
            className={cn(
              "mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition-colors",
              tab === "discover" ? "bg-secondary text-foreground" : "hover:bg-secondary/50 text-muted-foreground",
            )}
          >
            <Compass className="size-4" /> Discover crews
          </button>

          {(myInvites.data ?? []).length > 0 && (
            <div className="mt-4">
              <p className="eyebrow px-2">Invites</p>
              <div className="mt-1 space-y-1">
                {(myInvites.data ?? []).map((i) => (
                  <div key={i.id} className="bg-secondary/30 flex items-center gap-2 rounded-xl px-2 py-1.5">
                    <span className="text-sm">{i.crew?.badge_emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{i.crew?.name}</p>
                    </div>
                    <button onClick={() => acceptInvite(i)} className="text-primary text-[10px] font-semibold">
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* main */}
      <main className="glass relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
        {tab === "discover" ? (
          <DiscoverPanel crews={discoverable} onJoin={handleJoin} />
        ) : !active ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <Sparkles className="text-primary mx-auto size-8" />
              <p className="mt-2 text-lg font-semibold">Start your crew</p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                Crews share one XP pool, a private chat, a custom badge, banner and colour. Up to 25 people.
              </p>
              <Button className="mt-3" onClick={() => setCreating(true)}>
                Create a crew
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* header / banner */}
            <div className="relative border-b border-border/40">
              <div className="relative h-24 w-full overflow-hidden">
                {active.banner_url ? (
                  <img src={active.banner_url} alt={`${active.name} banner`} className="size-full object-cover" />
                ) : (
                  <div className={cn("size-full bg-gradient-to-br to-transparent", accent.glow)} />
                )}
                <div className="from-background/90 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
              </div>
              <div className="flex items-end justify-between gap-3 px-4 pb-3 -mt-7">
                <div className="flex items-end gap-3">
                  <span className={cn("bg-card grid size-14 place-items-center rounded-2xl text-2xl ring-2", accent.ring)}>
                    {active.badge_emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold leading-tight">{active.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {active.tagline || "No tagline yet"} · {active.visibility === "private" ? "Private" : "Public"}
                    </p>
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-4 sm:flex">
                  <div className="text-right">
                    <p className="eyebrow">Crew level</p>
                    <p className="text-sm font-semibold">
                      Lv {lvl.level} · {active.total_xp.toLocaleString()} XP
                    </p>
                    <div className="bg-secondary mt-1 h-1.5 w-32 overflow-hidden rounded-full">
                      <div className={cn("h-full rounded-full", accentOf(active.accent).dot)} style={{ width: `${lvl.pct}%` }} />
                    </div>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Users className="size-3.5" /> {active.memberCount}/{active.member_limit}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 px-3 pb-2">
                <TabBtn active={tab === "chat"} onClick={() => setTab("chat")}>
                  Chat
                </TabBtn>
                <TabBtn active={tab === "roster"} onClick={() => setTab("roster")}>
                  Roster
                </TabBtn>
                {canManage && (
                  <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>
                    <Settings2 className="mr-1 inline size-3.5" /> Customise
                  </TabBtn>
                )}
                {myRole !== "owner" && (
                  <button onClick={leave} className="text-muted-foreground hover:text-destructive ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs">
                    <LogOut className="size-3.5" /> Leave
                  </button>
                )}
              </div>
            </div>

            {tab === "roster" ? (
              <div className="flex-1 overflow-y-auto p-4">
                <Panel>
                  <PanelHead title={`Members · ${active.memberCount}/${active.member_limit}`} />
                  <div className="mt-2 space-y-2">
                    {(members.data ?? []).map((m) => (
                      <div key={m.user_id} className="bg-secondary/20 flex items-center gap-2 rounded-xl p-2">
                        <Avatar profile={m.profile as any} size={34} />
                        <div className="min-w-0 flex-1">
                          <ProfileLink profile={m.profile as any} className="truncate text-sm font-medium hover:underline" />
                          <p className="text-muted-foreground text-[10px] capitalize">{m.role}</p>
                        </div>
                        {myRole === "owner" && m.user_id !== profile?.id && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => promote(m, m.role === "captain" ? "member" : "captain")}
                              className="text-primary text-[10px] hover:underline"
                            >
                              {m.role === "captain" ? "Demote" : "Make captain"}
                            </button>
                            <button onClick={() => kick(m)} className="text-destructive text-[10px] hover:underline">
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Panel>

                {canManage && (
                  <Panel className="mt-3">
                    <PanelHead title="Invites" />
                    <form onSubmit={invite} className="mt-2 flex gap-2">
                      <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="username" className="h-8 text-sm" />
                      <Button type="submit" size="sm">
                        Invite
                      </Button>
                    </form>
                    <div className="mt-2 space-y-1">
                      {(invites.data ?? []).map((i) => (
                        <div key={i.id} className="bg-secondary/20 flex items-center justify-between rounded-lg px-2 py-1 text-xs">
                          <span className="truncate">{i.profile?.display_name || i.profile?.username}</span>
                          <button
                            onClick={() => revokeCrewInvite(active.id, i.user_id).then(() => invites.refetch())}
                            className="text-destructive hover:underline"
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                      {(invites.data ?? []).length === 0 && <p className="text-muted-foreground text-xs">No pending invites.</p>}
                    </div>
                  </Panel>
                )}
              </div>
            ) : tab === "settings" && canManage ? (
              <CrewSettings
                crew={active}
                userId={profile?.id ?? undefined}
                onSaved={async () => {
                  await crews.refetch();
                }}
              />
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {(messages.data ?? []).map((m) => (
                    <CrewChatRow key={m.id} message={m} isMe={m.user_id === profile?.id} onReply={() => setReplyTo(m)} />
                  ))}
                  {(messages.data ?? []).length === 0 && (
                    <p className="text-muted-foreground py-8 text-center text-sm">No messages yet — say hi to your crew.</p>
                  )}
                </div>

                {replyTo && (
                  <div className="border-t border-border/40 px-3 pt-2">
                    <ReplyChip target={replyTo as any} onCancel={() => setReplyTo(null)} />
                  </div>
                )}

                <form onSubmit={post} className="flex items-end gap-2 p-3 pt-2">
                  <ImagePicker onPick={postImage} />
                  <VoiceRecorder onSend={postVoice} />
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

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50",
      )}
    >
      {children}
    </button>
  );
}

function CreateCrewForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [emoji, setEmoji] = useState("🛡️");
  const [accent, setAccent] = useState<CrewAccent>("teal");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "invite">("invite");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const id = await createCrew({
        name: name.trim(),
        tagline: tagline.trim(),
        description: "",
        badge_emoji: emoji,
        accent,
        visibility,
        join_policy: visibility === "private" ? "invite" : joinPolicy,
      });
      onCreated(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create that crew");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-secondary/25 space-y-2 rounded-xl p-2.5">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Crew name" className="h-8 text-sm" maxLength={40} />
      <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" className="h-8 text-sm" maxLength={90} />

      <div className="flex flex-wrap gap-1">
        {CREW_EMOJI.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            className={cn("grid size-7 place-items-center rounded-lg text-sm", emoji === e ? "bg-secondary ring-1 ring-primary/50" : "hover:bg-secondary/60")}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CREW_ACCENTS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAccent(a.key)}
            title={a.label}
            className={cn("size-5 rounded-full ring-offset-2 ring-offset-background", a.dot, accent === a.key && "ring-2 ring-foreground/60")}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setVisibility("public")}
          className={cn("flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-xs", visibility === "public" ? "bg-secondary text-foreground" : "text-muted-foreground")}
        >
          <Globe className="size-3" /> Public
        </button>
        <button
          type="button"
          onClick={() => setVisibility("private")}
          className={cn("flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-xs", visibility === "private" ? "bg-secondary text-foreground" : "text-muted-foreground")}
        >
          <Lock className="size-3" /> Private
        </button>
      </div>

      {visibility === "public" && (
        <label className="text-muted-foreground flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={joinPolicy === "open"} onChange={(e) => setJoinPolicy(e.target.checked ? "open" : "invite")} />
          Anyone can join instantly
        </label>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={busy || !name.trim()}>
          {busy ? "Creating..." : "Create crew"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CrewSettings({ crew, userId, onSaved }: { crew: CrewRow; userId: string | undefined; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(crew.name);
  const [tagline, setTagline] = useState(crew.tagline ?? "");
  const [description, setDescription] = useState(crew.description ?? "");
  const [emoji, setEmoji] = useState(crew.badge_emoji);
  const [accent, setAccent] = useState<CrewAccent>(crew.accent);
  const [visibility, setVisibility] = useState<"public" | "private">(crew.visibility);
  const [joinPolicy, setJoinPolicy] = useState<"open" | "invite">(crew.join_policy);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateCrew(crew.id, {
        name,
        tagline,
        description,
        badge_emoji: emoji,
        accent,
        visibility,
        join_policy: visibility === "private" ? "invite" : joinPolicy,
      });
      await onSaved();
      toast.success("Crew updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  async function pickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    try {
      await uploadCrewBanner(crew.id, userId, file);
      await onSaved();
      toast.success("Banner updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload that image");
    }
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      <Panel>
        <PanelHead title="Identity" />
        <div className="mt-2 space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Crew name" maxLength={40} />
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" maxLength={90} />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this crew about?"
            maxLength={400}
            rows={3}
          />
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Badge & colour" />
        <div className="mt-2 flex flex-wrap gap-1">
          {CREW_EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={cn("grid size-9 place-items-center rounded-xl text-lg", emoji === e ? "bg-secondary ring-1 ring-primary/50" : "hover:bg-secondary/60")}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CREW_ACCENTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAccent(a.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
                accent === a.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50",
              )}
            >
              <span className={cn("size-3 rounded-full", a.dot)} /> {a.label}
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Banner" />
        <div className="mt-2 flex items-center gap-3">
          <div className="bg-secondary/40 h-16 w-40 shrink-0 overflow-hidden rounded-xl">
            {crew.banner_url ? (
              <img src={crew.banner_url} alt="Crew banner" className="size-full object-cover" />
            ) : (
              <div className={cn("size-full bg-gradient-to-br to-transparent", accentOf(accent).glow)} />
            )}
          </div>
          <label className="bg-secondary/60 hover:bg-secondary flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium">
            <ImagePlus className="size-4" /> Upload banner
            <input type="file" accept="image/*" className="hidden" onChange={pickBanner} />
          </label>
          {crew.banner_url && (
            <button
              onClick={async () => {
                await updateCrew(crew.id, { banner_url: "" });
                await onSaved();
              }}
              className="text-muted-foreground hover:text-destructive text-xs"
            >
              Remove
            </button>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHead title="Privacy" />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setVisibility("public")}
            className={cn("flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-sm", visibility === "public" ? "bg-secondary" : "text-muted-foreground hover:bg-secondary/50")}
          >
            <Globe className="size-4" /> Public
          </button>
          <button
            onClick={() => setVisibility("private")}
            className={cn("flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-sm", visibility === "private" ? "bg-secondary" : "text-muted-foreground hover:bg-secondary/50")}
          >
            <Lock className="size-4" /> Private
          </button>
        </div>
        {visibility === "public" && (
          <label className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={joinPolicy === "open"} onChange={(e) => setJoinPolicy(e.target.checked ? "open" : "invite")} />
            Anyone can join instantly (otherwise invite-only)
          </label>
        )}
      </Panel>

      <Button onClick={save} disabled={busy} className="w-full">
        {busy ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}

function DiscoverPanel({ crews, onJoin }: { crews: CrewRow[]; onJoin: (crew: CrewRow) => void }) {
  const [q, setQ] = useState("");
  const list = crews.filter((c) => `${c.name} ${c.tagline ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <PanelHead title="Discover crews" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search crews..." className="mt-2 h-9 text-sm" />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {list.map((c) => {
          const a = accentOf(c.accent);
          const cl = crewLevel(c.total_xp);
          return (
            <div key={c.id} className={cn("bg-secondary/20 overflow-hidden rounded-2xl ring-1", a.ring)}>
              <div className="relative h-14">
                {c.banner_url ? (
                  <img src={c.banner_url} alt={`${c.name} banner`} className="size-full object-cover" />
                ) : (
                  <div className={cn("size-full bg-gradient-to-br to-transparent", a.glow)} />
                )}
              </div>
              <div className="flex items-center gap-2 p-3">
                <span className="text-xl">{c.badge_emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-muted-foreground truncate text-[11px]">
                    Lv {cl.level} · {c.memberCount}/{c.member_limit} members
                  </p>
                </div>
                <Button size="sm" variant={c.join_policy === "open" ? "default" : "secondary"} onClick={() => onJoin(c)} disabled={c.join_policy !== "open"}>
                  {c.join_policy === "open" ? "Join" : "Invite only"}
                </Button>
              </div>
              {c.tagline && <p className="text-muted-foreground px-3 pb-3 text-xs">{c.tagline}</p>}
            </div>
          );
        })}
        {list.length === 0 && <p className="text-muted-foreground text-sm">No public crews to show yet.</p>}
      </div>
    </div>
  );
}

function CrewChatRow({ message, isMe, onReply }: { message: CrewMessage; isMe: boolean; onReply: () => void }) {
  const a = message.author;
  return (
    <div className={cn("flex gap-2", isMe && "flex-row-reverse")}>
      <Avatar profile={a as any} size={34} />
      <div className={cn("max-w-[80%] rounded-2xl px-3 py-2", isMe ? "bg-primary text-primary-foreground" : "bg-secondary")}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold opacity-90">{a?.display_name || a?.username}</span>
          <span className="text-[10px] opacity-60">
            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        {message.reply_to_id && <ReplyQuote target={message as any} />}
        {message.image_url ? <ChatImage src={message.image_url} /> : <p className="whitespace-pre-wrap text-sm">{message.body}</p>}
        {message.audio_url && <VoicePlayer url={message.audio_url} ms={message.audio_ms ?? 0} />}
        <button onClick={onReply} className="mt-1 text-[10px] opacity-60 hover:opacity-100">
          Reply
        </button>
      </div>
    </div>
  );
}
