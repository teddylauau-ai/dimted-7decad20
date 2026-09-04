import { cn } from "@/lib/utils";
import { rankForLevel, type Rank } from "@/lib/dimted";

const rankTone: Record<Rank["tier"], { base: string; border: string; text: string; icon: string }> = {
  newcomer: {
    base: "from-slate-500/20 to-slate-400/10",
    border: "border-slate-400/30",
    text: "text-slate-200",
    icon: "✦",
  },
  explorer: {
    base: "from-emerald-500/20 to-emerald-400/10",
    border: "border-emerald-400/30",
    text: "text-emerald-200",
    icon: "◆",
  },
  vanguard: {
    base: "from-primary/25 to-primary/10",
    border: "border-primary/35",
    text: "text-primary-foreground",
    icon: "▲",
  },
  elite: {
    base: "from-violet-500/20 to-violet-400/10",
    border: "border-violet-400/30",
    text: "text-violet-200",
    icon: "✸",
  },
  prime: {
    base: "from-amber-500/25 to-gold/10",
    border: "border-gold/40",
    text: "text-gold",
    icon: "✹",
  },
  apex: {
    base: "from-rose-500/20 to-rose-400/10",
    border: "border-rose-400/30",
    text: "text-rose-200",
    icon: "◉",
  },
};

export function RankBadge({
  level,
  size = "md",
  className,
}: {
  level: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const rank = rankForLevel(level);
  const tone = rankTone[rank.tier];
  const sizes = {
    sm: "h-5 w-5 text-[9px]",
    md: "h-7 w-7 text-[11px]",
    lg: "h-10 w-10 text-base",
  }[size];

  return (
    <span
      title={rank.label}
      className={cn(
        "rank-emblem shrink-0 bg-gradient-to-br border",
        tone.base,
        tone.border,
        tone.text,
        sizes,
        className,
      )}
    >
      {tone.icon}
    </span>
  );
}

export function RankPill({ level, className }: { level: number; className?: string }) {
  const rank = rankForLevel(level);
  const tone = rankTone[rank.tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase",
        tone.border,
        tone.text,
        className,
      )}
    >
      <span>{tone.icon}</span>
      {rank.label}
    </span>
  );
}
