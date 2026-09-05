/**
 * Small global "+XP" badge.
 *
 * Rewards are granted anywhere (DMs, crews, games), so the confirmation has to
 * live in the shell rather than only on Home. It floats bottom-right, out of
 * the way of the message composer, and fades itself out after a few seconds.
 */
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useDimted } from "@/lib/dimted-store";

export function XpFlash() {
  const { lastGain } = useDimted();
  const [shown, setShown] = useState<typeof lastGain>(null);

  useEffect(() => {
    if (!lastGain) return;
    setShown(lastGain);
    const t = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(t);
  }, [lastGain]);

  if (!shown) return null;

  return (
    <div
      key={shown.at}
      className="glass-raised animate-pop-in border-primary/30 text-primary pointer-events-none fixed bottom-24 right-4 z-50 flex max-w-[70vw] items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs shadow-lg md:bottom-6"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="font-semibold">+{shown.amount} XP</span>
      <span className="text-muted-foreground truncate">{shown.label}</span>
    </div>
  );
}
