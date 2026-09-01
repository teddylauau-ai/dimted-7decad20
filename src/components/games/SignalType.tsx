import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Signal Type — 45 seconds of falling transmissions. Type the highlighted word
 * and press space or enter. Accuracy builds a streak multiplier.
 */

const WORDS = [
  "aurora","signal","pulse","nova","drift","glow","cipher","orbit","spark","surge",
  "prism","vector","comet","relay","quantum","lattice","echo","zenith","flux","halo",
  "beacon","cascade","ember","fathom","glimmer","horizon","ion","kinetic","lumen","mirage",
  "nebula","onyx","phase","quasar","ripple","stellar","tempo","umbra","vertex","whisper",
];

const DURATION = 45;

export function SignalType({
  running,
  onScore,
  onEnd,
}: {
  running: boolean;
  onScore: (score: number) => void;
  onEnd: (score: number) => void;
}) {
  const [word, setWord] = useState(() => WORDS[0]!);
  const [typed, setTyped] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [left, setLeft] = useState(DURATION);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const cbs = useRef({ onScore, onEnd });
  cbs.current = { onScore, onEnd };
  const scoreRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    setWord(WORDS[Math.floor(Math.random() * WORDS.length)]!);
    setTyped("");
    setScore(0);
    scoreRef.current = 0;
    setStreak(0);
    setLeft(DURATION);
    cbs.current.onScore(0);
    input.current?.focus();

    const started = performance.now();
    const id = window.setInterval(() => {
      const remaining = Math.max(0, DURATION - (performance.now() - started) / 1000);
      setLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        window.clearInterval(id);
        cbs.current.onEnd(scoreRef.current);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  function submit(value: string = typed) {
    const ok = value.trim().toLowerCase() === word;
    if (ok) {
      const next = streak + 1;
      const mult = Math.min(8, 1 + Math.floor(next / 3));
      const gain = (40 + word.length * 12) * mult;
      scoreRef.current += gain;
      setScore(scoreRef.current);
      setStreak(next);
      cbs.current.onScore(scoreRef.current);
      setFlash("hit");
    } else {
      setStreak(0);
      setFlash("miss");
    }
    window.setTimeout(() => setFlash(null), 180);
    setTyped("");
    setWord(WORDS[Math.floor(Math.random() * WORDS.length)]!);
  }

  const mult = Math.min(8, 1 + Math.floor(streak / 3));

  return (
    <div className="flex w-full max-w-[520px] flex-col items-center gap-4">
      <div className="text-muted-foreground flex w-full justify-between font-mono text-[11px]">
        <span className="text-foreground numeral text-base">{score.toLocaleString()}</span>
        <span className="text-gold">×{mult}</span>
        <span>{left}s</span>
      </div>

      <div
        className={cn(
          "border-border bg-background/40 grid w-full place-items-center rounded-xl border py-10 transition-colors",
          flash === "hit" && "border-primary bg-primary/10",
          flash === "miss" && "border-destructive/60 bg-destructive/10",
        )}
      >
        <p className="font-display text-4xl font-semibold tracking-tight">
          {word.split("").map((ch, i) => (
            <span
              key={i}
              className={cn(
                typed[i] === undefined
                  ? "text-foreground"
                  : typed[i] === ch
                    ? "text-primary"
                    : "text-destructive",
              )}
            >
              {ch}
            </span>
          ))}
        </p>
        <p className="text-muted-foreground mt-2 font-mono text-[11px]">
          streak {streak} · space or enter to send
        </p>
      </div>

      <input
        ref={input}
        value={typed}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Type the transmission"
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(" ")) submit(v.trimEnd());
          else setTyped(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        className="border-border bg-secondary/40 focus-visible:ring-ring w-full rounded-xl border px-4 py-3 text-center font-mono text-lg tracking-wide focus-visible:ring-2 focus-visible:outline-none"
        placeholder="type here"
      />
    </div>
  );
}
