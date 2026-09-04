import { useEffect, useState } from "react";

/**
 * Phone-status-bar style clock: live time with a softly pulsing colon,
 * plus the date — sits in the top strip like a handset status bar.
 */
export function StatusClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hh = now.toLocaleTimeString([], { hour: "2-digit" }).slice(0, 2);
  const mm = now.toLocaleTimeString([], { minute: "2-digit" }).slice(-2);
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
        {hh}
        <span className="animate-pulse">:</span>
        {mm}
      </span>
      <span className="bg-border h-3 w-px" />
      <span className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
        {date}
      </span>
    </div>
  );
}
