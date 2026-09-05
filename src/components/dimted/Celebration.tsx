import { useEffect, useMemo, useState } from "react";

/**
 * Lightweight full-screen celebration: coloured pieces rain down once, then the
 * layer removes itself. Purely decorative, so it never blocks pointer events and
 * skips entirely for people who ask for reduced motion.
 */
export function Celebration({ trigger, label }: { trigger: number; label?: string | undefined }) {
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    setRunId(trigger);
    const t = window.setTimeout(() => setRunId(0), 3200);
    return () => window.clearTimeout(t);
  }, [trigger]);

  const pieces = useMemo(() => {
    if (!runId) return [];
    const colors = ["#2dd4bf", "#fcd34d", "#a78bfa", "#38bdf8", "#f472b6", "#34d399"];
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      duration: 1.8 + Math.random() * 1.2,
      size: 5 + Math.random() * 7,
      rotate: Math.random() * 360,
      color: colors[i % colors.length]!,
      round: i % 4 === 0,
    }));
  }, [runId]);

  if (!runId) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {label ? (
        <div className="animate-scale-in absolute top-16 left-1/2 -translate-x-1/2">
          <span className="glass-surface text-foreground rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-lg">
            {label}
          </span>
        </div>
      ) : null}
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.8,
            background: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animation: `lz-confetti ${p.duration}s cubic-bezier(0.25,0.6,0.35,1) ${p.delay}s forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}
          className="absolute -top-6 opacity-90"
        />
      ))}
    </div>
  );
}
