import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Phone-status-bar style clock: live 12-hour time with a pulsing colon,
 * a sun/moon AM/PM marker, and the date — sits in the top strip.
 */
export function StatusClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const isPm = hour >= 12;
  const displayHour = hour % 12 || 12;
  const mm = now.getMinutes().toString().padStart(2, "0");
  const date = now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });

  return (
    <div
      className="glass-raised flex items-center gap-2 rounded-full px-3.5 py-1.5 select-none"
      aria-label={now.toLocaleString()}
    >
      <span className="relative flex size-1.5">
        <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
        <span className="bg-primary relative inline-flex size-1.5 rounded-full" />
      </span>
      <span className="font-mono text-xs font-medium tabular-nums tracking-wider">
        {displayHour}
        <span className="animate-pulse">:</span>
        {mm}
      </span>
      <span className="text-muted-foreground/80" aria-hidden="true">
        {isPm ? <Moon className="size-3.5" /> : <Sun className="size-3.5 text-amber-400" />}
      </span>
      <span className="bg-border h-3 w-px" />
      <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
        {date}
      </span>
    </div>
  );
}
