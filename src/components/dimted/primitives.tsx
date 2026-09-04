import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RARITY_LABEL, type Rarity } from "@/lib/dimted";
import { rarityBg, rarityBorder, rarityText } from "./rarity";

export function Panel({
  className,
  children,
  delay = 0,
}: {
  className?: string | undefined;
  children: ReactNode;
  delay?: number | undefined;
}) {
  return (
    <section
      className={cn("glass animate-rise rounded-2xl", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </section>
  );
}

export function PanelHead({
  eyebrow,
  title,
  aside,
  className,
}: {
  eyebrow?: string | undefined;
  title: string;
  aside?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="font-display mt-1 text-lg font-semibold tracking-tight text-balance">{title}</h2>
      </div>
      {aside ? <div className="text-muted-foreground shrink-0 font-mono text-[11px]">{aside}</div> : null}
    </div>
  );
}

export function RarityChip({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.16em] uppercase",
        rarityBorder[rarity],
        rarityBg[rarity],
        rarityText[rarity],
        className,
      )}
    >
      {RARITY_LABEL[rarity]}
    </span>
  );
}

export function Meter({
  value,
  className,
  tone = "primary",
  animate = false,
}: {
  value: number;
  className?: string | undefined;
  tone?: "primary" | "gold" | "xp" | "energy" | undefined;
  animate?: boolean | undefined;
}) {
  const fill = {
    primary: "from-primary/70 to-primary",
    gold: "from-gold/60 to-gold",
    xp: "from-xp/60 to-primary",
    energy: "from-energy/60 to-gold",
  }[tone];

  return (
    <div className={cn("bg-background/70 ring-border h-2 overflow-hidden rounded-full ring-1", className)}>
      <div
        className={cn(
          "relative h-full origin-left rounded-full bg-gradient-to-r",
          fill,
          animate && "animate-xp-fill",
        )}
        style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
      >
        <span
          className="animate-shimmer absolute inset-0 opacity-70"
          style={{
            background:
              "linear-gradient(100deg, transparent 30%, oklch(1 0 0 / 0.55) 50%, transparent 70%)",
            backgroundSize: "220% 100%",
          }}
        />
      </div>
    </div>
  );
}

export function LockedTile({
  hint,
  requirement,
  className,
}: {
  hint: string;
  requirement: string;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "border-secret/25 bg-secret/[0.06] group relative overflow-hidden rounded-xl border border-dashed p-4 text-center transition-colors hover:border-secret/50",
        className,
      )}
    >
      <p className="numeral text-secret/70 text-2xl">???</p>
      <p className="text-foreground/85 mt-2 text-sm">{hint}</p>
      <p className="text-muted-foreground mt-2 font-mono text-[11px]">{requirement}</p>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  blurb,
  aside,
}: {
  eyebrow: string;
  title: string;
  blurb?: string | undefined;
  aside?: ReactNode | undefined;
}) {
  return (
    <header className="border-border animate-rise flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display mt-1.5 text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        {blurb ? <p className="text-muted-foreground mt-2 max-w-xl text-sm">{blurb}</p> : null}
      </div>
      {aside}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/30 px-6 py-8 text-center">
      {Icon ? (
        <div className="bg-secondary text-muted-foreground mb-3 grid size-12 place-items-center rounded-2xl">
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="font-display text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
