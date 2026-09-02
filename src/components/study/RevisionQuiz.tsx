import { useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Deck, shuffled } from "@/lib/study-bank";
import { cn } from "@/lib/utils";

/**
 * Offline revision quiz: fixed curriculum question bank, instant feedback with
 * an explanation for every answer. No AI call involved.
 */
export function RevisionQuiz({
  deck,
  onFinish,
  onExit,
}: {
  deck: Deck;
  onFinish: (percent: number, correct: number, total: number) => void;
  onExit: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const questions = useMemo(() => shuffled(deck.questions), [deck, attempt]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[index]!;
  const total = questions.length;
  const percent = Math.round((correct / total) * 100);

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.answer) setCorrect((c) => c + 1);
  };

  const next = () => {
    if (index + 1 >= total) {
      const finalCorrect = correct;
      const pct = Math.round((finalCorrect / total) * 100);
      setFinished(true);
      onFinish(pct, finalCorrect, total);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  const restart = () => {
    setAttempt((a) => a + 1);
    setIndex(0);
    setPicked(null);
    setCorrect(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="eyebrow">{deck.name}</p>
        <p className="numeral text-5xl">{percent}%</p>
        <p className="text-muted-foreground text-sm">
          {correct} of {total} correct
          {percent >= 80 ? " — that's a pass mark, deck mastered." : " — run it again to lock it in."}
        </p>
        <div className="flex gap-2">
          <Button onClick={restart}>
            <RotateCcw className="size-4" /> Retry deck
          </Button>
          <Button variant="outline" onClick={onExit}>
            Pick another deck
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{deck.strand}</p>
          <h3 className="font-display mt-1 truncate text-base font-semibold tracking-tight">
            {deck.name}
          </h3>
        </div>
        <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
          {index + 1}/{total} · {correct} right
        </span>
      </div>

      <div className="bg-secondary/50 h-1 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${((index + (picked !== null ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      <p className="text-base leading-relaxed font-medium">{q.q}</p>

      <div className="grid gap-2">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer;
          const chosen = picked === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
                picked === null && "border-border hover:border-primary/40 hover:bg-secondary/40",
                picked !== null && isAnswer && "border-primary/60 bg-primary/10",
                picked !== null && chosen && !isAnswer && "border-destructive/60 bg-destructive/10",
                picked !== null && !isAnswer && !chosen && "border-border opacity-55",
              )}
            >
              <span className="text-muted-foreground w-4 shrink-0 font-mono text-[11px]">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">{opt}</span>
              {picked !== null && isAnswer ? <Check className="text-primary size-4 shrink-0" /> : null}
              {picked !== null && chosen && !isAnswer ? (
                <X className="text-destructive size-4 shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>

      {picked !== null ? (
        <div className="border-border bg-secondary/30 space-y-3 rounded-xl border p-3.5">
          <p className="text-sm leading-relaxed">
            <span className="eyebrow mr-2">Why</span>
            {q.why}
          </p>
          <Button size="sm" onClick={next}>
            {index + 1 >= total ? "See result" : "Next question"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
