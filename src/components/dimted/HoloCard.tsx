import { useState } from "react";
import { levelFromTotalXp, rankForLevel } from "@/lib/dimted";
import { Avatar } from "./Identity";
import { RankBadge } from "./RankBadge";

type HoloProfile = {
  id: string;
  username: string;
  display_name: string;
  title: string;
  total_xp: number;
  last_active_at: string;
  activity_context?: string | null;
  avatar_url: string | null;
  banner_url?: string | null;
  equipped_nametag?: string | null;
  equipped_badge?: string | null;
  equipped_frame?: string | null;
  equipped_banner?: string | null;
  equipped_effect?: string | null;
};

export function HoloCardTrigger({
  profile,
  children,
}: {
  profile: HoloProfile | null | undefined;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!profile) return children;
  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-block cursor-pointer"
        aria-label={`Open ${profile.display_name || profile.username} profile card`}
      >
        {children}
      </span>
      <HoloCard profile={profile} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function HoloCard({
  profile,
  open,
  onClose,
}: {
  profile: HoloProfile;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const { level } = levelFromTotalXp(profile.total_xp);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-raised relative w-full max-w-sm overflow-hidden rounded-3xl p-1">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-gold/10" />
        <div className="relative overflow-hidden rounded-[22px] bg-background/40 p-6 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground absolute top-3 right-3 text-sm"
            aria-label="Close"
          >
            ✕
          </button>

          <div className="mx-auto mb-4 inline-flex items-center gap-3 rounded-full border border-border/60 bg-background/60 px-3 py-1.5">
            <RankBadge level={level} size="sm" />
            <span className="font-display text-sm font-semibold">{rankForLevel(level)}</span>
          </div>

          <div className="relative mx-auto mb-4 inline-flex">
            <Avatar profile={profile} size={96} />
          </div>

          <h3 className="font-display text-xl font-semibold tracking-tight">
            {profile.display_name || profile.username}
          </h3>
          <p className="text-muted-foreground text-sm">@{profile.username}</p>

          {profile.title ? (
            <p className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">
              {profile.title}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat label="Level" value={level} />
            <Stat label="XP" value={profile.total_xp} />
            <Stat label="Rank" value={rankForLevel(level)} />
          </div>

          <div className="mt-4 rounded-xl border border-border/50 bg-background/40 p-3 text-xs text-muted-foreground">
            Share this profile: <span className="text-foreground">/u/{profile.username}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-2">
      <p className="numeral text-lg font-semibold">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</p>
    </div>
  );
}
