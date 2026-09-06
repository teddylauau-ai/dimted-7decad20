import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Echo Sequence — memory under pressure. The grid plays back a growing pattern,
 * you repeat it. Playback speeds up each round and one wrong pad ends the run.
 */

const PADS = 6;
const TONES = ["#2ee6c4", "#7db9ff", "#f6c860", "#ff7aa2", "#a78bfa", "#5ce6a0"];

export function EchoSequence({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const s = useRef({
    seq: [] as number[],
    step: 0,
    round: 0,
    score: 0,
    over: false,
    accepting: false,
  });
  const [lit, setLit] = useState<number | null>(null);
  const [view, setView] = useState({ round: 0, score: 0, phase: "watch" as "watch" | "repeat" });
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!running) return;
    const st = s.current;
    st.seq = [];
    st.step = 0;
    st.round = 0;
    st.score = 0;
    st.over = false;
    st.accepting = false;
    cbs.current.onScore(0);

    const clearTimers = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };

    const playback = () => {
      const st2 = s.current;
      st2.accepting = false;
      setView({ round: st2.round, score: st2.score, phase: "watch" });
      const on = Math.max(180, 520 - st2.round * 22);
      const gap = Math.max(90, 240 - st2.round * 10);
      st2.seq.forEach((pad, i) => {
        timers.current.push(
          window.setTimeout(() => setLit(pad), i * (on + gap)),
          window.setTimeout(() => setLit(null), i * (on + gap) + on),
        );
      });
      timers.current.push(
        window.setTimeout(
          () => {
            const st3 = s.current;
            st3.step = 0;
            st3.accepting = true;
            setView({ round: st3.round, score: st3.score, phase: "repeat" });
          },
          st2.seq.length * (on + gap) + 120,
        ),
      );
    };

    const nextRound = () => {
      const st2 = s.current;
      st2.round += 1;
      st2.seq.push(Math.floor(Math.random() * PADS));
      playback();
    };

    (window as unknown as { __echoNext?: () => void }).__echoNext = nextRound;
    timers.current.push(window.setTimeout(nextRound, 500));

    return () => {
      clearTimers();
      s.current.over = true;
    };
  }, [running]);

  function tap(pad: number) {
    const st = s.current;
    if (!running || st.over || !st.accepting) return;
    if (st.seq[st.step] !== pad) {
      st.over = true;
      st.accepting = false;
      cbs.current.onEnd(st.score);
      return;
    }
    setLit(pad);
    window.setTimeout(() => setLit(null), 130);
    st.step += 1;
    if (st.step >= st.seq.length) {
      st.accepting = false;
      st.score += 120 + st.round * 45;
      cbs.current.onScore(st.score);
      setView({ round: st.round, score: st.score, phase: "watch" });
      const next = (window as unknown as { __echoNext?: () => void }).__echoNext;
      timers.current.push(window.setTimeout(() => next?.(), 650));
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-muted-foreground flex w-full max-w-[340px] items-baseline justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{view.score.toLocaleString()}</span>
        <span className="text-primary">round {view.round}</span>
        <span className={view.phase === "repeat" ? "text-gold" : ""}>
          {view.phase === "repeat" ? "your turn" : "watch"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2" style={{ width: "min(340px, 86vw)" }}>
        {Array.from({ length: PADS }, (_, i) => (
          <button
            key={i}
            type="button"
            onPointerDown={() => tap(i)}
            className={cn(
              "aspect-square rounded-2xl border transition-all duration-100",
              lit === i ? "scale-[1.04] border-transparent" : "border-border bg-secondary/40",
            )}
            style={
              lit === i
                ? { background: TONES[i], boxShadow: `0 0 30px -4px ${TONES[i]}` }
                : undefined
            }
            aria-label={`Pad ${i + 1}`}
          />
        ))}
      </div>
      <p className="text-muted-foreground font-mono text-[10px]">Watch the echo, repeat it back</p>
    </div>
  );
}
