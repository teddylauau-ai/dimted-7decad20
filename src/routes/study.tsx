import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { useDimted } from "@/lib/dimted-store";
import { askTutor } from "@/lib/study.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/study")({
  head: () => ({
    meta: [
      { title: "Study with Tutor — Dimted" },
      {
        name: "description",
        content:
          "Tutor is Dimted's built-in study helper: ask about homework, get step-by-step explanations, revise for tests and earn XP while you learn.",
      },
      { property: "og:title", content: "Study with Tutor — Dimted" },
      {
        property: "og:description",
        content: "Step-by-step homework help and revision, built into Dimted.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUBJECTS = [
  "Maths",
  "English",
  "Science",
  "History",
  "Geography",
  "Coding",
  "Languages",
] as const;

const STARTERS = [
  "Explain quadratic equations like I'm 12",
  "Quiz me on cell biology",
  "Help me plan an essay on WWI causes",
  "Why does this code loop forever?",
];

function StudyPage() {
  const { award } = useDimted();
  const run = useServerFn(askTutor);
  const [subject, setSubject] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const awarded = useRef(0);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      const next: Msg[] = [...messages, { role: "user", content: clean }];
      setMessages(next);
      setDraft("");
      setBusy(true);
      try {
        const res = await run({
          data: {
            ...(subject ? { subject } : {}),
            messages: next.slice(-16),
          },
        });
        if (res.error || !res.reply) {
          toast.error(res.error ?? "Tutor could not answer that.");
          setMessages(next);
        } else {
          setMessages([...next, { role: "assistant", content: res.reply }]);
          if (awarded.current < 3) {
            awarded.current += 1;
            void award("message", "Study session");
          }
        }
      } catch {
        toast.error("Tutor is unreachable right now.");
      } finally {
        setBusy(false);
      }
    },
    [award, busy, messages, run, subject],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Study"
        title="Tutor"
        blurb="Your built-in study partner. Ask about homework, get worked examples, or get quizzed before a test — first few sessions each visit pay XP."
        aside={
          <div className="glass-raised text-muted-foreground flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px]">
            <Sparkles className="text-primary size-3.5" /> earns XP
          </div>
        }
      />

      <Panel className="p-4 sm:p-5">
        <PanelHead eyebrow="Focus" title="Pick a subject" aside={subject ?? "any"} />
        <div className="mt-3 flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject((cur) => (cur === s ? null : s))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                subject === s
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="flex h-[min(62vh,620px)] flex-col overflow-hidden">
        <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="glass-raised text-primary rounded-2xl p-3">
                <BookOpen className="size-6" />
              </div>
              <p className="text-muted-foreground max-w-sm text-sm">
                Ask anything you're stuck on. Tutor explains the steps instead of just giving answers.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="border-border text-muted-foreground hover:border-primary/30 hover:text-foreground rounded-full border px-3 py-1.5 text-xs transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary/15 border-primary/30 border"
                      : "glass-raised border-border border",
                  )}
                >
                  {m.role === "assistant" ? (
                    <p className="eyebrow mb-1.5">Tutor</p>
                  ) : null}
                  {m.content}
                </div>
              </div>
            ))
          )}
          {busy ? (
            <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
              <Loader2 className="size-3.5 animate-spin" /> Tutor is thinking…
            </div>
          ) : null}
        </div>

        <form
          className="border-border flex items-center gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={subject ? `Ask a ${subject} question…` : "Ask a study question…"}
            maxLength={2000}
            aria-label="Ask Tutor a study question"
          />
          <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label="Send">
            <SendHorizontal className="size-4" />
          </Button>
        </form>
      </Panel>
    </div>
  );
}
