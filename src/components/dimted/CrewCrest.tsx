import { cn } from "@/lib/utils";
import { CREW_CRESTS, crestsFor, topCrest, type CrewCrest as Crest } from "@/lib/crews";

const SIZES = {
  xs: "size-[16px] text-[9px] rounded-[5px]",
  sm: "size-[20px] text-[11px]",
  md: "size-6 text-[13px]",
  lg: "size-9 text-lg rounded-lg",
} as const;

/** One crest chip — real badge art, not a text label. */
export function CrestMark({
  crest,
  size = "sm",
  className,
  title,
}: {
  crest: Crest;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? `${crest.label} crest — crew level ${crest.unlock}`}
      className={cn("crew-crest", SIZES[size], className)}
      aria-label={`${crest.label} crest`}
    >
      <span className={cn("crew-crest-glyph")}>{crest.glyph}</span>
    </span>
  );
}

/** Inner glyph + shell colours live on the same element for simplicity. */
export function CrewCrestBadge({
  xp,
  size = "sm",
  className,
}: {
  xp: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const crest = topCrest(xp);
  if (!crest) return null;
  return <CrestMark crest={crest} size={size} className={cn(crest.cls, className)} />;
}

/** All crests a crew has earned, shown side by side. */
export function CrewCrestRow({ xp, size = "xs", max = 4 }: { xp: number; size?: keyof typeof SIZES; max?: number }) {
  const earned = crestsFor(xp).slice(-max).reverse();
  if (!earned.length) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {earned.map((c) => (
        <CrestMark key={c.key} crest={c} size={size} className={c.cls} />
      ))}
    </span>
  );
}

/** Preview of every crest on the ladder, used on the Rewards tab. */
export function CrestLadder({ level }: { level: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {CREW_CRESTS.map((c) => {
        const earned = level >= c.unlock;
        return (
          <div
            key={c.key}
            className={cn(
              "flex items-center gap-2.5 rounded-xl p-2.5",
              earned ? "bg-primary/10 ring-primary/25 ring-1" : "bg-secondary/20 opacity-70",
            )}
          >
            <CrestMark crest={c} size="lg" className={c.cls} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {c.label} crest{" "}
                <span className="text-muted-foreground font-mono text-[10px]">Lv {c.unlock}</span>
              </p>
              <p className="text-muted-foreground truncate text-[11px]">{earned ? c.blurb : `Unlocks at crew level ${c.unlock}`}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
