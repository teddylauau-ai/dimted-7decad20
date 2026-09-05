import { useEffect, useMemo, useState } from "react";
import { GripHorizontal, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelHead } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import {
  DEFAULT_WIDGETS,
  fetchProfileWidgets,
  normalizeLayout,
  saveProfileWidgets,
  WIDGET_LABELS,
  type ProfileWidget,
  type WidgetType,
} from "@/lib/widgets";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Avatar, Nametag } from "./Identity";
import { RankBadge, RankPill } from "./RankBadge";
import { Meter } from "./primitives";
import { SpotifyPicks } from "./SpotifyPicks";
import { Showcase } from "./Showcase";
import { useCosmetics, useFriendships, usePlayerStats } from "@/lib/dimted-queries";
import { ACHIEVEMENTS, friendshipLevel, levelFromTotalXp, TITLES, UNLOCKS } from "@/lib/dimted";
import { SLOTS } from "@/lib/cosmetics";
import { rarityBorder, rarityText } from "./rarity";

const GRID_COLS = 2;

export function WidgetProfile({ userId, editable = false }: { userId: string | undefined; editable?: boolean }) {
  const { profile: me, level, rank, intoLevel, needed, progress, totalXp } = useDimted();
  const isMe = me?.id === userId;
  const profile = isMe ? me : null; // public profile fetched separately for others

  const widgetsQ = useQuery({
    queryKey: ["profile-widgets", userId],
    enabled: !!userId,
    queryFn: () => fetchProfileWidgets(userId),
    refetchInterval: 10000,
  });

  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<Omit<ProfileWidget, "id" | "user_id">[]>([]);

  useEffect(() => {
    if (widgetsQ.data) {
      const base = widgetsQ.data.length ? widgetsQ.data : DEFAULT_WIDGETS;
      setLayout(base.map((w) => ({ ...w, id: undefined, user_id: undefined })));
    }
  }, [widgetsQ.data]);

  const cosmetics = useCosmetics();
  const stats = usePlayerStats(userId, totalXp);
  const friends = useFriendships(userId);

  async function save() {
    if (!userId) return;
    try {
      const normalized = normalizeLayout(layout.map((w, i) => ({ ...w, id: `temp-${i}`, user_id: userId }))).map(({ id, user_id, ...rest }) => rest);
      const res = await saveProfileWidgets(normalized);
      if (!res.ok) throw new Error(res.error || "Save failed");
      await widgetsQ.refetch();
      setEditing(false);
      toast.success("Profile layout saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save layout");
    }
  }

  const displayWidgets = useMemo(() => {
    const base = widgetsQ.data?.length ? widgetsQ.data : DEFAULT_WIDGETS;
    return editing ? layout : base;
  }, [widgetsQ.data, layout, editing]);

  function add(type: WidgetType) {
    const maxY = layout.reduce((m, w) => Math.max(m, w.position_y + w.height - 1), -1);
    setLayout((prev) => [...prev, { widget_type: type, position_x: 0, position_y: maxY + 1, width: 2, height: 1, config: {} }]);
  }

  function remove(idx: number) {
    setLayout((prev) => prev.filter((_, i) => i !== idx));
  }

  function move(idx: number, dx: number, dy: number) {
    setLayout((prev) =>
      prev.map((w, i) =>
        i === idx
          ? { ...w, position_x: Math.max(0, Math.min(GRID_COLS - w.width, w.position_x + dx)), position_y: Math.max(0, w.position_y + dy) }
          : w
      )
    );
  }

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <PanelHead title="Widget Profile" eyebrow="Custom grid" />
        {editable && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setLayout((widgetsQ.data?.length ? widgetsQ.data : DEFAULT_WIDGETS).map((w) => ({ ...w, id: undefined, user_id: undefined }))); }}>Cancel</Button>
                <Button size="sm" onClick={() => void save()}>Save</Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit grid</Button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap gap-2 border-b border-border/40 pb-3">
          {(Object.keys(WIDGET_LABELS) as WidgetType[]).map((type) => (
            <button
              key={type}
              onClick={() => add(type)}
              className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs hover:bg-secondary/70"
            >
              <Plus className="size-3" /> {WIDGET_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        {displayWidgets.map((w, idx) => (
          <div
            key={`${w.widget_type}-${idx}`}
            className={cn(
              "relative overflow-hidden rounded-xl border border-border/40 bg-secondary/20 p-3",
              w.width === 2 ? "col-span-2" : "col-span-1"
            )}
            style={{ gridRow: `span ${w.height}` }}
          >
            {editing && (
              <div className="absolute top-2 right-2 flex gap-1">
                <button onClick={() => move(idx, 0, -1)} className="grid size-6 place-items-center rounded-md bg-secondary text-[10px]">↑</button>
                <button onClick={() => move(idx, 0, 1)} className="grid size-6 place-items-center rounded-md bg-secondary text-[10px]">↓</button>
                <button onClick={() => move(idx, -1, 0)} className="grid size-6 place-items-center rounded-md bg-secondary text-[10px]">←</button>
                <button onClick={() => move(idx, 1, 0)} className="grid size-6 place-items-center rounded-md bg-secondary text-[10px]">→</button>
                <button onClick={() => remove(idx)} className="grid size-6 place-items-center rounded-md bg-destructive/20 text-destructive"><Trash2 className="size-3" /></button>
              </div>
            )}
            <WidgetContent
              type={w.widget_type}
              profile={profile || me}
              level={level}
              rank={rank}
              intoLevel={intoLevel}
              needed={needed}
              progress={progress}
              totalXp={totalXp}
              cosmetics={cosmetics.data ?? []}
              stats={stats}
              friends={friends.data ?? []}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function WidgetContent({
  type,
  profile,
  level,
  rank,
  intoLevel,
  needed,
  progress,
  totalXp,
  cosmetics,
  stats,
  friends,
}: {
  type: WidgetType;
  profile: any;
  level: number;
  rank: string;
  intoLevel: number;
  needed: number;
  progress: number;
  totalXp: number;
  cosmetics: any[];
  stats: any;
  friends: any[];
}) {
  switch (type) {
    case "rank":
      return (
        <div className="flex items-center gap-4">
          <Avatar profile={profile} size={64} />
          <div>
            <Nametag profile={profile} as="span" className="font-display text-lg font-semibold" />
            <RankPill level={level} />
            <p className="text-muted-foreground mt-1 font-mono text-[10px]">{rank}</p>
            <Meter value={progress} tone="xp" className="mt-2 h-2 w-40" />
            <p className="text-muted-foreground mt-1 text-[10px]">{intoLevel.toLocaleString()} / {needed.toLocaleString()} XP</p>
          </div>
        </div>
      );
    case "stats":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Lifetime XP" value={totalXp.toLocaleString()} />
          <Stat label="Level" value={level} />
          <Stat label="Achievements" value={`${ACHIEVEMENTS.filter((a) => a.earned(stats)).length}/${ACHIEVEMENTS.length}`} />
          <Stat label="Unlocks" value={`${UNLOCKS.filter((u) => u.level <= level).length}/${UNLOCKS.length}`} />
        </div>
      );
    case "spotify":
      return <SpotifyPicks userId={profile?.id} editable={false} emptyHint="No Spotify picks yet." />;
    case "achievements":
      return (
        <div className="flex flex-wrap gap-2">
          {ACHIEVEMENTS.filter((a) => a.earned(stats)).slice(0, 6).map((a) => (
            <span key={a.id} className={cn("rounded-full border px-2 py-0.5 text-[10px]", rarityBorder[a.rarity], rarityText[a.rarity])}>{a.name}</span>
          ))}
        </div>
      );
    case "showcase":
      return <Showcase slugs={profile?.showcase} cosmetics={cosmetics} editable={false} />;
    case "friends":
      return (
        <div className="space-y-1">
          {friends.filter((f) => f.status === "accepted").slice(0, 5).map((f) => (
            <div key={f.id} className="flex items-center justify-between text-xs">
              <span className="truncate">{f.profile.display_name}</span>
              <span className="text-muted-foreground font-mono text-[10px]">{f.streak}d</span>
            </div>
          ))}
        </div>
      );
    case "pulse":
      return (
        <div className="space-y-1 text-sm">
          <p>Pulse Rush best: <span className="font-semibold">{stats.pulseBestPct ?? 0}%</span></p>
          <p>Coins: <span className="font-semibold">{stats.pulseCoins ?? 0}</span></p>
        </div>
      );
    case "bio":
      return (
        <div>
          <p className="text-muted-foreground text-sm">{profile?.bio || "No bio yet."}</p>
          <p className="text-muted-foreground mt-2 font-mono text-[10px]">Title: {profile?.title || "Newcomer"}</p>
        </div>
      );
    default:
      return null;
  }
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-secondary/40 p-2">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p className="font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
