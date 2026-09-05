import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, BarChart3, Gauge, Check, Compass, Crown, Gamepad2, Gift, Globe, ImagePlus, Lock, LogOut, Plus, Search, Send, Settings2, Sparkles, Users } from "lucide-react";
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
  ACCENT_TEXT,
  CREW_BADGE_STYLES,
  CREW_CHAT_BGS,
  CREW_NAMETAGS,
  CREW_PERKS,
  crewPerkFlags,
  CREW_RANKS,
  rankOf,
  rankLevel,
  setCrewRank,
  type CrewRole,
  CREW_TEXT_EFFECTS,
  accentOf,
  chatBgStyle,
  acceptCrewInvite,
  contributeCrewXp,
  createCrew,
  crewLevel,
  crewChatXp,
  crewMaxProgress,
  CREW_MAX_XP,
  CREW_MAX_LEVEL,
  fetchCrewInvites,
  fetchCrewMembers,
  fetchCrewMessages,
  fetchCrews,
  fetchInvitablePeople,
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
  ownerDeleteCrew,
  CREW_MAX_LEVEL,
  updateCrew,
  uploadCrewAvatar,
  uploadCrewBanner,
  type CrewAccent,
  type CrewBadgeStyle,
  type CrewChatBg,
  type CrewNametag,
  type CrewPerk,
  type CrewTextEffect,
  type CrewInvite,
  type CrewMember,
  type CrewMessage,
  type CrewRow,
} from "@/lib/crews";
import { useMyRole } from "@/lib/roles-queries";
import { VoicePlayer, VoiceRecorder } from "@/components/dimted/VoiceMessage";
import { ChatImage, ImagePicker, ReplyChip, ReplyQuote, findReplyTarget } from "@/components/dimted/ChatExtras";
import { CallPanel } from "@/components/dimted/CallPanel";
import { CrewFlight } from "@/components/dimted/CrewFlight";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

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

type Tab = "chat" | "roster" | "settings" | "discover" | "ladder" | "perks" | "skyward" | "stats";

function CrewsPage() {
  const { profile, award } = useDimted();
  const { isStaff, isOwner } = useMyRole(profile?.id);

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
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const chatList = useMemo(() => messages.data ?? [], [messages.data]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatList.length, active?.id, tab]);

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

  async function inviteUser(userId: string) {
    if (!active || !profile) return;
    try {
      await inviteToCrew(active.id, userId, profile.id);
      await invites.refetch();
      toast.success("Invite sent");
    } catch {
      toast.error("Couldn't invite — they may already be invited");
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

  /** Chatting feeds the crew's shared XP pool. */
  async function bankCrewXp(amount: number) {
    if (!active) return;
    try {
      await contributeCrewXp(active.id, amount);
      await crews.refetch();
    } catch {
      /* crew pool is a bonus — never block the message */
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
      await bankCrewXp(crewChatXp(active.total_xp, "text"));
    } catch {
      toast.error("Message didn't post");
    }
  }

  async function postVoice(blob: Blob, ms: number) {
    if (!profile || !active) return;
    await postCrewVoiceMessage(active.id, profile.id, blob, ms);
    await messages.refetch();
    await award("message", "Crew voice");
    await bankCrewXp(crewChatXp(active.total_xp, "rich"));
  }

  async function postImage(file: File) {
    if (!profile || !active) return;
    try {
      await postCrewImageMessage(active.id, profile.id, file);
      await messages.refetch();
      await award("message", "Crew image");
      await bankCrewXp(crewChatXp(active.total_xp, "rich"));
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

  async function setRank(member: CrewMember, role: CrewRole) {
    if (!active) return;
    try {
      await setCrewRank(active.id, member.user_id, role);
      await members.refetch();
      toast.success(`${member.profile.display_name || member.profile.username} is now ${rankOf(role).label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update rank");
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
  const perkFlags = crewPerkFlags(active?.total_xp ?? 0);
  const jointTaken = (members.data ?? []).some((m) => m.role === "captain");


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
                  <CrewMark crew={c} size={32} />
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
                Crews share one XP pool, a private chat, a custom badge, banner and colour. Up to 25 people (100 once the owner lifts the cap).
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
              <div className="relative h-20 w-full overflow-hidden">
                {active.banner_url ? (
                  <img src={active.banner_url} alt={`${active.name} banner`} className="size-full object-cover" />
                ) : (
                  <div className={cn("size-full bg-gradient-to-br to-transparent", accent.glow)} />
                )}
                <div className="from-background absolute inset-0 bg-gradient-to-t via-background/30 to-transparent" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-2">
                <div className="flex min-w-0 items-center gap-3">
                  <CrewMark crew={active} size={52} rounded="rounded-2xl" />
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-1.5 truncate text-lg font-semibold leading-tight">
                      <span className="truncate">{active.name}</span>
                      {perkFlags.legendCrest && (
                        <span className="shrink-0 rounded-md bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200 ring-1 ring-violet-400/30">
                          ✦ Legend
                        </span>
                      )}
                      {perkFlags.apex && (
                        <span className="text-gold ring-gold/40 bg-gold/10 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1">
                          Apex
                        </span>
                      )}
                      {perkFlags.skywardBoost && (
                        <span className="text-primary bg-primary/10 ring-primary/30 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1">
                          Skyward {perkFlags.skywardBoost2 ? "2x" : "1.5x"}
                        </span>
                      )}
                      {perkFlags.centurion && (
                        <span className="text-gold ring-gold/50 bg-gold/15 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1">
                          Centurion
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {active.tagline || "No tagline yet"} · {active.visibility === "private" ? "Private" : "Public"}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <div className="hidden text-right sm:block">
                    <p className="eyebrow">Crew level</p>
                    <p className="text-sm font-semibold">
                      Lv {lvl.level} · {active.total_xp.toLocaleString()} XP
                    </p>
                    <div className="bg-secondary mt-1 h-1.5 w-32 overflow-hidden rounded-full">
                      <div className={cn("h-full rounded-full", accent.dot)} style={{ width: `${lvl.pct}%` }} />
                    </div>
                  </div>
                  <div className="text-muted-foreground hidden items-center gap-1 text-xs sm:flex">
                    <Users className="size-3.5" /> {active.memberCount}/{active.member_limit}
                  </div>
                  <CallPanel
                    scope="crew"
                    scopeId={active.id}
                    meId={profile?.id}
                    meProfile={profile as never}
                    lookup={(id) => (members.data ?? []).find((m) => m.user_id === id)?.profile ?? null}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 px-3 pb-2">
                <TabBtn active={tab === "chat"} onClick={() => setTab("chat")}>
                  Chat
                </TabBtn>
                <TabBtn active={tab === "roster"} onClick={() => setTab("roster")}>
                  Roster
                </TabBtn>
                <TabBtn active={tab === "skyward"} onClick={() => setTab("skyward")}>
                  <Gamepad2 className="mr-1 inline size-3.5" /> Skyward
                </TabBtn>
                <TabBtn active={tab === "ladder"} onClick={() => setTab("ladder")}>
                  <BarChart3 className="mr-1 inline size-3.5" /> Ladder
                </TabBtn>
                <TabBtn active={tab === "stats"} onClick={() => setTab("stats")}>
                  <Gauge className="mr-1 inline size-3.5" /> Dashboard
                </TabBtn>
                <TabBtn active={tab === "perks"} onClick={() => setTab("perks")}>
                  <Gift className="mr-1 inline size-3.5" /> Rewards
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

            {tab === "skyward" ? (
              <div className="flex-1 overflow-y-auto p-4">
                <CrewFlight crewId={active.id} crewName={active.name} boostMult={perkFlags.skywardBoost2 ? 2 : perkFlags.skywardBoost ? 1.5 : 1} />
              </div>
            ) : tab === "ladder" ? (
              <div className="flex-1 overflow-y-auto p-4">
                <CrewLadder crews={rows} activeId={active.id} />
              </div>
            ) : tab === "stats" ? (
              <div className="flex-1 overflow-y-auto p-4">
                <CrewDashboard crews={rows} activeId={active.id} />
              </div>
            ) : tab === "perks" ? (
              <div className="flex-1 overflow-y-auto p-4">
                <CrewRewards level={lvl.level} xp={active.total_xp} nextAt={lvl.next} />
              </div>
            ) : tab === "roster" ? (
              <div className="flex-1 overflow-y-auto p-4">
                <Panel>
                  <PanelHead title={`Members · ${active.memberCount}/${active.member_limit}`} />
                  <div className="mt-2 space-y-2">
                    {[...(members.data ?? [])]
                      .sort((a, b) => rankLevel(b.role) - rankLevel(a.role) || a.joined_at.localeCompare(b.joined_at))
                      .map((m) => {
                        const rank = rankOf(m.role);
                        const myLevel = isStaff ? 5 : rankLevel(myRole);
                        const canRank =
                          (isStaff || myLevel >= 4) && m.user_id !== profile?.id && rankLevel(m.role) < myLevel;
                        return (
                          <div key={m.user_id} className="bg-secondary/20 flex items-center gap-2 rounded-xl p-2">
                            <Avatar profile={m.profile as any} size={34} />
                            <div className="min-w-0 flex-1">
                              <ProfileLink profile={m.profile as any} className="truncate text-sm font-medium hover:underline" />
                              <span className={cn("mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold", rank.cls)}>
                                {rank.label}
                              </span>
                            </div>
                            {canRank && (
                              <div className="flex items-center gap-2">
                                <select
                                  aria-label={`Rank for ${m.profile.display_name || m.profile.username}`}
                                  value={m.role}
                                  onChange={(e) => setRank(m, e.target.value as CrewRole)}
                                  className="bg-secondary/60 rounded-lg px-1.5 py-1 text-[10px] outline-none"
                                >
                                  {CREW_RANKS.filter((r) => {
                                    if (r.level >= 5) return false;
                                    if (r.key === "captain")
                                      return (
                                        (isStaff || myLevel >= 5) && (!jointTaken || m.role === "captain")
                                      );
                                    return r.level < myLevel;
                                  }).map((r) => (
                                    <option key={r.key} value={r.key}>
                                      {r.label}
                                    </option>
                                  ))}

                                </select>
                                <button onClick={() => kick(m)} className="text-destructive text-[10px] hover:underline">
                                  Remove
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </Panel>

                <Panel className="mt-3">
                  <PanelHead
                    title="Top contributors"
                    aside={<span className="text-muted-foreground text-xs">XP banked for this crew</span>}
                  />
                  <div className="mt-2 space-y-1.5">
                    {[...(members.data ?? [])]
                      .sort((a, b) => (b.contributed_xp ?? 0) - (a.contributed_xp ?? 0))
                      .map((m, i) => (
                        <div key={m.user_id} className="bg-secondary/20 flex items-center gap-2 rounded-xl p-2">
                          <span
                            className={cn(
                              "w-6 shrink-0 text-center text-xs font-bold",
                              i === 0 && "text-amber-300",
                              i === 1 && "text-slate-300",
                              i === 2 && "text-orange-300",
                              i > 2 && "text-muted-foreground",
                            )}
                          >
                            {i + 1}
                          </span>
                          <Avatar profile={m.profile as any} size={28} />
                          <ProfileLink
                            profile={m.profile as any}
                            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                          />
                          <span className="text-primary shrink-0 text-xs font-bold tabular-nums">
                            {(m.contributed_xp ?? 0).toLocaleString()} XP
                          </span>
                        </div>
                      ))}
                    {(members.data ?? []).every((m) => !(m.contributed_xp > 0)) && (
                      <p className="text-muted-foreground px-1 text-xs">
                        Nobody has banked crew XP yet — chat and play Skyward to climb this ladder.
                      </p>
                    )}
                  </div>
                </Panel>

                <Panel className="mt-3">
                  <PanelHead title="Rank ladder" />
                  <div className="mt-2 space-y-1.5">
                    {CREW_RANKS.map((r) => (
                      <div key={r.key} className="flex items-start gap-2">
                        <span className={cn("w-20 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold", r.cls)}>
                          {r.label}
                        </span>
                        <p className="text-muted-foreground text-[11px] leading-snug">{r.blurb}</p>
                      </div>
                    ))}
                  </div>
                </Panel>

                {canManage && (
                  <Panel className="mt-3">
                    <PanelHead title="Invites" />
                    <InvitePicker
                      crew={active}
                      memberIds={(members.data ?? []).map((m) => m.user_id)}
                      invitedIds={(invites.data ?? []).map((i) => i.user_id)}
                      onInvite={inviteUser}
                    />
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
              <div className="flex-1 overflow-y-auto">
                <CrewSettings
                  crew={active}
                  userId={profile?.id ?? undefined}
                  onSaved={async () => {
                    await crews.refetch();
                  }}
                />
                {isOwner ? (
                  <div className="border-destructive/40 bg-destructive/5 m-3 rounded-xl border p-3.5">
                    <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-destructive">
                      Owner · danger zone
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Deletes this crew, its chat, invites and roster for everyone. This cannot be undone.
                    </p>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="mt-2.5"
                      onClick={async () => {
                        if (!window.confirm(`Delete ${active.name} for good?`)) return;
                        try {
                          const res = await ownerDeleteCrew(active.id);
                          if (res.status !== "ok") {
                            toast.error("Owner only.");
                            return;
                          }
                          toast.success("Crew deleted.");
                          setActiveId(null);
                          await crews.refetch();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "That did not go through.");
                        }
                      }}
                    >
                      Delete this crew
                    </Button>
                  </div>
                ) : null}
              </div>

            ) : (
              <>
                <div
                  ref={scrollRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
                  }}
                  className="relative flex-1 overflow-y-auto px-3 py-4"
                >
                  <div
                    aria-hidden
                    className={cn("pointer-events-none absolute inset-0", ACCENT_TEXT[active.accent])}
                    style={chatBgStyle(active.chat_bg)}
                  />
                  <div className="relative">
                  {chatList.map((m, i) => {
                    const previous = chatList[i - 1];
                    const grouped =
                      !!previous &&
                      previous.user_id === m.user_id &&
                      Date.parse(m.created_at) - Date.parse(previous.created_at) < 5 * 60 * 1000 &&
                      new Date(previous.created_at).toDateString() === new Date(m.created_at).toDateString();
                    const dayStarts =
                      !previous ||
                      new Date(previous.created_at).toDateString() !== new Date(m.created_at).toDateString();
                    return (
                      <div key={m.id} id={`msg-${m.id}`} className="rounded-lg transition-colors duration-500">
                        {dayStarts ? (
                          <div className="my-4 flex items-center gap-3">
                            <span className="bg-border h-px flex-1" />
                            <span className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
                              {new Date(m.created_at).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
                            </span>
                            <span className="bg-border h-px flex-1" />
                          </div>
                        ) : null}
                        <CrewChatRow
                          message={m}
                          crew={active}
                          grouped={grouped}
                          list={chatList}
                          onReply={() => setReplyTo(m)}
                        />
                      </div>
                    );
                  })}
                  {chatList.length === 0 && (
                    <p className="text-muted-foreground py-8 text-center text-sm">No messages yet — say hi to your crew.</p>
                  )}
                  </div>
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

/** Small crew badge next to names in crew chat — shell style is customisable. */
function StyleRow({
  label,
  options,
  value,
  level,
  onPick,
}: {
  label: string;
  options: { key: string; label: string; unlock: number }[];
  value: string;
  level: number;
  onPick: (key: string) => void;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1 text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const locked = level < o.unlock;
          return (
            <button
              key={o.key}
              type="button"
              disabled={locked}
              onClick={() => onPick(o.key)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs transition-colors",
                value === o.key ? "bg-secondary text-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:bg-secondary/50",
                locked && "cursor-not-allowed opacity-40",
              )}
            >
              {o.label}
              {locked ? ` · Lv ${o.unlock}` : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CrewBadgeChip({ crew }: { crew: CrewRow }) {
  const a = accentOf(crew.accent);
  const shell = CREW_BADGE_STYLES.find((b) => b.key === crew.badge_style) ?? CREW_BADGE_STYLES[0]!;
  return (
    <span
      title={crew.name}
      className={cn(
        "grid size-4 shrink-0 place-items-center overflow-hidden rounded text-[9px] leading-none",
        ACCENT_TEXT[crew.accent],
        a.ring,
        shell.cls,
      )}
    >
      {crew.avatar_url ? <img src={crew.avatar_url} alt="" className="size-full object-cover" /> : crew.badge_emoji}
    </span>
  );
}

function CrewLadder({ crews, activeId }: { crews: CrewRow[]; activeId: string }) {
  const ranked = [...crews].sort((a, b) => b.total_xp - a.total_xp);
  return (
    <Panel>
      <PanelHead title="Crew ladder" aside={<span className="text-muted-foreground text-xs">Ranked by shared XP</span>} />
      <div className="mt-2 space-y-1.5">
        {ranked.map((c, i) => {
          const cl = crewLevel(c.total_xp);
          const a = accentOf(c.accent);
          const perks = crewPerkFlags(c.total_xp);
          return (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2 py-2",
                c.id === activeId ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary/20",
                perks.spotlight && cn("ring-1", a.ring, "shadow-[0_0_18px_-8px_currentColor]", ACCENT_TEXT[c.accent]),
                perks.apex && "ring-gold/50 shadow-[0_0_22px_-8px_hsl(var(--gold))] ring-1",
              )}
            >
              <span
                className={cn(
                  "font-display w-7 text-center text-sm font-bold",
                  i === 0 ? "text-gold" : i < 3 ? "text-primary" : "text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <CrewMark crew={c} size={30} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <span className="truncate">{c.name}</span>
                  {perks.legendCrest && (
                    <span title="Legend crest — crew level 25" className="text-gold shrink-0">
                      <Crown className="size-3.5" />
                    </span>
                  )}
                  {perks.apex && (
                    <span className="bg-gold/15 text-gold shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                      Apex
                    </span>
                  )}
                </p>
                <div className="bg-secondary mt-1 h-1.5 w-full max-w-40 overflow-hidden rounded-full">
                  <div className={cn("h-full rounded-full", a.dot)} style={{ width: `${cl.pct}%` }} />
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-semibold">Lv {cl.level}</p>
                <p className="text-muted-foreground text-[10px]">{c.total_xp.toLocaleString()} XP</p>
              </div>
              <div className="text-muted-foreground hidden w-16 items-center justify-end gap-1 text-xs sm:flex">
                <Users className="size-3" /> {c.memberCount}
              </div>
            </div>
          );
        })}
        {ranked.length === 0 && <p className="text-muted-foreground text-sm">No crews on the ladder yet.</p>}
      </div>
    </Panel>
  );
}

function CrewDashboard({ crews, activeId }: { crews: CrewRow[]; activeId: string }) {
  const rows = [...crews]
    .map((c) => {
      const cl = crewLevel(c.total_xp);
      const max = crewMaxProgress(c.total_xp);
      const members = Math.max(1, c.memberCount);
      return {
        crew: c,
        level: cl.level,
        pctOfLevel: cl.pct,
        toNextLevel: Math.max(0, cl.next - c.total_xp),
        avgPerMember: Math.round(c.total_xp / members),
        remainingToMax: max.remaining,
        pctOfMax: max.pct,
      };
    })
    .sort((a, b) => b.crew.total_xp - a.crew.total_xp);

  const totalXp = rows.reduce((n, r) => n + r.crew.total_xp, 0);
  const totalMembers = rows.reduce((n, r) => n + r.crew.memberCount, 0);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Panel>
          <p className="eyebrow">Crews tracked</p>
          <p className="font-display mt-0.5 text-2xl font-bold">{rows.length}</p>
        </Panel>
        <Panel>
          <p className="eyebrow">Shared XP banked</p>
          <p className="font-display mt-0.5 text-2xl font-bold">{totalXp.toLocaleString()}</p>
        </Panel>
        <Panel>
          <p className="eyebrow">Average per member</p>
          <p className="font-display mt-0.5 text-2xl font-bold">
            {totalMembers ? Math.round(totalXp / totalMembers).toLocaleString() : 0}
          </p>
        </Panel>
      </div>

      <Panel>
        <PanelHead
          title="Crew XP dashboard"
          aside={
            <span className="text-muted-foreground text-xs">
              Cap = Level {CREW_MAX_LEVEL} · {CREW_MAX_XP.toLocaleString()} XP
            </span>
          }
        />
        <div className="mt-2 space-y-2">
          {rows.map((r) => {
            const a = accentOf(r.crew.accent);
            const f = crewPerkFlags(r.crew.total_xp);
            return (
              <div
                key={r.crew.id}
                className={cn(
                  "rounded-xl p-2.5",
                  r.crew.id === activeId ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary/20",
                  f.spotlight && cn("ring-1", a.ring),
                  f.apex && "ring-gold/50 ring-1",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <CrewMark crew={r.crew} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      <span className="truncate">{r.crew.name}</span>
                      {f.legendCrest && <span className="shrink-0 text-[11px] text-violet-200">✦</span>}
                      {f.apex && <span className="text-gold shrink-0 text-[10px] font-semibold">Apex</span>}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      Lv {r.level} · {r.crew.memberCount} member{r.crew.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <p className="text-sm font-semibold">{r.crew.total_xp.toLocaleString()} XP</p>
                </div>

                <div className="mt-2 grid gap-1.5 text-[11px] sm:grid-cols-3">
                  <div className="glass-surface rounded-lg px-2 py-1.5">
                    <p className="text-muted-foreground">Average per member</p>
                    <p className="font-semibold">{r.avgPerMember.toLocaleString()} XP</p>
                  </div>
                  <div className="glass-surface rounded-lg px-2 py-1.5">
                    <p className="text-muted-foreground">To level {r.level + 1}</p>
                    <p className="font-semibold">{r.toNextLevel.toLocaleString()} XP</p>
                  </div>
                  <div className="glass-surface rounded-lg px-2 py-1.5">
                    <p className="text-muted-foreground">To max ladder</p>
                    <p className="font-semibold">{r.remainingToMax.toLocaleString()} XP</p>
                  </div>
                </div>

                <div className="bg-secondary mt-2 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className={cn("h-full rounded-full", a.dot)}
                    style={{ width: `${Math.max(1.5, r.pctOfMax)}%` }}
                  />
                </div>
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {r.pctOfMax}% of the way to the maximum crew level · {r.pctOfLevel}% through level {r.level}
                </p>
              </div>
            );
          })}
          {rows.length === 0 && <p className="text-muted-foreground text-sm">No crews to chart yet.</p>}
        </div>
      </Panel>
    </div>
  );
}

function CrewRewards({ level, xp, nextAt }: { level: number; xp: number; nextAt: number }) {
  const flags = crewPerkFlags(xp);
  const live = [
    { label: "Ladder spotlight", on: flags.spotlight, at: 18 },
    { label: "Skyward 1.5x XP", on: flags.skywardBoost, at: 20 },
    { label: "Legend crest", on: flags.legendCrest, at: 25 },
    { label: "Apex gold trim", on: flags.apex, at: 30 },
    { label: "Skyward 2x XP", on: flags.skywardBoost2, at: 50 },
    { label: "Chat XP ceiling x8", on: flags.chatXpUnleashed, at: 70 },
    { label: "Sovereign trim", on: flags.sovereignTrim, at: 85 },
    { label: "Centurion crest", on: flags.centurion, at: 100 },
  ];
  return (
    <div className="space-y-3">
      <Panel>
        <PanelHead
          title={`Crew level ${level}`}
          aside={
            <span className="text-muted-foreground text-xs">
              {level >= CREW_MAX_LEVEL ? "MAXED" : `${Math.max(0, nextAt - xp).toLocaleString()} XP to next level`}
            </span>
          }
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Everything your crew does — chat, voice notes, images and Skyward runs — pours into one shared pool. Each
          message currently banks <span className="text-primary font-semibold">{crewChatXp(xp, "text")} XP</span> (
          {crewChatXp(xp, "rich")} XP for voice notes and images).
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {live.map((l) => (
            <span
              key={l.label}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                l.on
                  ? "bg-primary/15 text-primary ring-primary/30"
                  : "bg-secondary text-muted-foreground ring-border/50",
              )}
            >
              {l.label} · {l.on ? "live" : `Lv ${l.at}`}
            </span>
          ))}
        </div>
      </Panel>

      <div className="grid gap-2 sm:grid-cols-2">
        {CREW_PERKS.map((p: CrewPerk) => {
          const unlocked = level >= p.level;
          return (
            <div
              key={p.level}
              className={cn(
                "glass rounded-xl p-3",
                unlocked ? "ring-1 ring-primary/25" : "opacity-70",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{p.title}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    unlocked ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {unlocked ? "Unlocked" : `Lv ${p.level}`}
                </span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{p.blurb}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CrewMark({ crew, size = 32, rounded = "rounded-lg" }: { crew: CrewRow; size?: number; rounded?: string }) {
  const a = accentOf(crew.accent);
  return (
    <span
      className={cn("grid shrink-0 place-items-center overflow-hidden ring-1", rounded, a.ring, "bg-secondary/50")}
      style={{ width: size, height: size }}
    >
      {crew.avatar_url ? (
        <img src={crew.avatar_url} alt={`${crew.name} picture`} className="size-full object-cover" />
      ) : (
        <span style={{ fontSize: Math.round(size * 0.5) }}>{crew.badge_emoji}</span>
      )}
    </span>
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
  const [badgeStyle, setBadgeStyle] = useState<CrewBadgeStyle>(crew.badge_style ?? "plain");
  const [nametag, setNametag] = useState<CrewNametag>(crew.nametag_style ?? "none");
  const [textEffect, setTextEffect] = useState<CrewTextEffect>(crew.text_effect ?? "none");
  const [chatBg, setChatBg] = useState<CrewChatBg>(crew.chat_bg ?? "none");
  const [busy, setBusy] = useState(false);
  const level = crewLevel(crew.total_xp).level;

  async function save() {
    // Never save a style the crew hasn't unlocked yet.
    const allowed = <T extends string>(opts: { key: T; unlock: number }[], val: T, fallback: T) =>
      (opts.find((o) => o.key === val)?.unlock ?? 99) <= level ? val : fallback;
    const safeBadge = allowed(CREW_BADGE_STYLES, badgeStyle, "plain");
    const safeNametag = allowed(CREW_NAMETAGS, nametag, "none");
    const safeEffect = allowed(CREW_TEXT_EFFECTS, textEffect, "none");
    const safeBg = allowed(CREW_CHAT_BGS, chatBg, "none");
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
        badge_style: safeBadge,
        nametag_style: safeNametag,
        text_effect: safeEffect,
        chat_bg: safeBg,
      });
      setBadgeStyle(safeBadge);
      setNametag(safeNametag);
      setTextEffect(safeEffect);
      setChatBg(safeBg);
      await onSaved();
      toast.success("Crew updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    try {
      await uploadCrewAvatar(crew.id, userId, file);
      await onSaved();
      toast.success("Crew picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload that image");
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
        <PanelHead title="Crew picture" />
        <div className="mt-2 flex items-center gap-3">
          <div className={cn("bg-secondary/40 grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl ring-1", accentOf(accent).ring)}>
            {crew.avatar_url ? (
              <img src={crew.avatar_url} alt="Crew picture" className="size-full object-cover" />
            ) : (
              <span className="text-2xl">{emoji}</span>
            )}
          </div>
          <label className="bg-secondary/60 hover:bg-secondary flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium">
            <ImagePlus className="size-4" /> Upload picture
            <input type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
          </label>
          {crew.avatar_url && (
            <button
              onClick={async () => {
                await updateCrew(crew.id, { avatar_url: "" });
                await onSaved();
              }}
              className="text-muted-foreground hover:text-destructive text-xs"
            >
              Use emoji instead
            </button>
          )}
        </div>
        <p className="text-muted-foreground mt-2 text-[11px]">A picture replaces the emoji badge everywhere.</p>
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
        <PanelHead
          title="Crew style"
          aside={<span className="text-muted-foreground text-xs">Crew level {level}</span>}
        />
        <div className="mt-2 space-y-3">
          <StyleRow
            label="Badge shell"
            options={CREW_BADGE_STYLES}
            value={badgeStyle}
            level={level}
            onPick={(k) => setBadgeStyle(k as CrewBadgeStyle)}
          />
          <StyleRow
            label="Crew nametag"
            options={CREW_NAMETAGS}
            value={nametag}
            level={level}
            onPick={(k) => setNametag(k as CrewNametag)}
          />
          <StyleRow
            label="Message effect"
            options={CREW_TEXT_EFFECTS}
            value={textEffect}
            level={level}
            onPick={(k) => setTextEffect(k as CrewTextEffect)}
          />
          <StyleRow
            label="Chat background"
            options={CREW_CHAT_BGS}
            value={chatBg}
            level={level}
            onPick={(k) => setChatBg(k as CrewChatBg)}
          />
          <div className="bg-secondary/30 relative overflow-hidden rounded-xl p-3">
            <div
              aria-hidden
              className={cn("pointer-events-none absolute inset-0", ACCENT_TEXT[accent])}
              style={chatBgStyle(chatBg)}
            />
            <div className="relative flex items-center gap-1.5">
              <span className={cn("grid size-4 place-items-center rounded text-[9px]", ACCENT_TEXT[accent], accentOf(accent).ring, (CREW_BADGE_STYLES.find((b) => b.key === badgeStyle) ?? CREW_BADGE_STYLES[0]!).cls)}>
                {emoji}
              </span>
              <span className={cn("text-xs", ACCENT_TEXT[accent], (CREW_NAMETAGS.find((n) => n.key === nametag) ?? CREW_NAMETAGS[0]!).cls)}>
                {name || "Crew name"}
              </span>
            </div>
            <p className={cn("relative mt-1 text-sm", (CREW_TEXT_EFFECTS.find((f) => f.key === textEffect) ?? CREW_TEXT_EFFECTS[0]!).cls)}>
              This is how your crew messages will look.
            </p>
          </div>
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
                <CrewMark crew={c} size={34} rounded="rounded-xl" />
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

function CrewChatRow({
  message,
  crew,
  grouped,
  list,
  onReply,
}: {
  message: CrewMessage;
  crew: CrewRow;
  grouped: boolean;
  list: CrewMessage[];
  onReply: () => void;
}) {
  const a = message.author;
  const tag = CREW_NAMETAGS.find((n) => n.key === crew.nametag_style) ?? CREW_NAMETAGS[0]!;
  const fx = CREW_TEXT_EFFECTS.find((f) => f.key === crew.text_effect) ?? CREW_TEXT_EFFECTS[0]!;
  const accentText = ACCENT_TEXT[crew.accent];
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cn("chat-row group hover:bg-secondary/35 flex gap-3 rounded-lg px-2 py-1 transition-colors", grouped ? "mt-0" : "mt-3")}>
      {grouped ? (
        <span className="text-muted-foreground/0 group-hover:text-muted-foreground/70 w-9 shrink-0 pt-0.5 text-right font-mono text-[9px]">
          {time}
        </span>
      ) : (
        <Avatar profile={a as any} size={36} className="mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        {message.reply_to_id ? (
          <ReplyQuote
            target={findReplyTarget(list as never, message as never)}
            onJump={(id) => {
              const el = document.getElementById(`msg-${id}`);
              el?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
          />
        ) : null}
        {grouped ? null : (
          <p className="flex items-baseline gap-2">
            <CrewBadgeChip crew={crew} />
            <span className={cn("text-sm font-semibold", tag.cls, tag.key !== "none" && accentText)}>
              {a?.display_name || a?.username}
            </span>
            <span className="text-muted-foreground font-mono text-[10px]">{time}</span>
          </p>
        )}
        {message.image_url ? (
          <ChatImage src={message.image_url} />
        ) : message.body ? (
          <p className={cn("whitespace-pre-wrap text-sm", fx.cls)}>{message.body}</p>
        ) : null}
        {message.audio_url && <VoicePlayer url={message.audio_url} ms={message.audio_ms ?? 0} />}
      </div>
      <button
        onClick={onReply}
        className="text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground self-start rounded p-0.5 text-[10px]"
      >
        Reply
      </button>
    </div>
  );
}

function InvitePicker({
  crew,
  memberIds,
  invitedIds,
  onInvite,
}: {
  crew: CrewRow;
  memberIds: string[];
  invitedIds: string[];
  onInvite: (userId: string) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const people = useQuery({
    queryKey: ["invitable-people"],
    queryFn: fetchInvitablePeople,
    staleTime: 30_000,
  });

  const list = (people.data ?? [])
    .filter((p) => !memberIds.includes(p.id))
    .filter((p) => `${p.display_name} ${p.username}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="mt-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people..."
          className="h-9 pl-8 text-sm"
        />
      </div>
      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
        {list.map((p) => {
          const invited = invitedIds.includes(p.id);
          return (
            <div key={p.id} className="bg-secondary/20 flex items-center gap-2 rounded-xl px-2 py-1.5">
              <Avatar profile={p as never} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{p.display_name}</p>
                <p className="text-muted-foreground truncate text-[10px]">@{p.username}</p>
              </div>
              <Button
                size="sm"
                variant={invited ? "secondary" : "default"}
                disabled={invited}
                onClick={() => void onInvite(p.id)}
                className="h-7 px-2 text-[11px]"
              >
                {invited ? (
                  <>
                    <Check className="mr-1 size-3" /> Invited
                  </>
                ) : (
                  "Invite"
                )}
              </Button>
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="text-muted-foreground py-3 text-center text-xs">
            {people.isLoading ? "Loading people..." : `Nobody else to invite to ${crew.name} yet.`}
          </p>
        )}
      </div>
    </div>
  );
}
