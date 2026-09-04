import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, GraduationCap, Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelHead, PageHeader } from "@/components/dimted/primitives";
import { RevisionQuiz } from "@/components/study/RevisionQuiz";
import { useDimted } from "@/lib/dimted-store";
import { useRefreshDimted } from "@/lib/dimted-queries";
import { askTutor } from "@/lib/study.functions";
import { DECKS, SUBJECT_LIST, type Deck } from "@/lib/study-bank";
import { bestFor, masteredCount, useSaveAttempt, useStudyProgress } from "@/lib/study-queries";
import { awardArcadeXp } from "@/lib/games-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/study")({
  head: () => ({
    meta: [
      { title: "Study — Tutor & Year 9 Revision Decks | Dimted" },
      {
        name: "description",
        content:
          "Dimted Study: AI Tutor for step-by-step homework help plus offline Year 9 Australian Curriculum revision decks in Maths, Science, English, History and Geography. Earn XP as you revise.",
      },
      { property: "og:title", content: "Study — Tutor & Year 9 Revision Decks | Dimted" },
      {
        property: "og:description",
        content:
          "Homework help plus Australian Curriculum Year 9 revision quizzes with instant explanations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudyPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUBJECTS = ["Maths", "English", "Science", "History", "Geography", "Coding", "Languages"] as const;

const STARTERS = [
  "Explain index laws like I'm 12",
  "Quiz me on plate tectonics",
  "Help me plan an essay on WWI causes",
  "Check my persuasive paragraph",
];

function StudyPage() {
  const [tab, setTab] = useState<"revision" | "tutor">("revision");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Study"
        title="Study hub"
        blurb="Two ways to work: revision decks built from the Year 9 Australian Curriculum (no AI, works offline) or Tutor for step-by-step help. Both pay XP."
        aside={
          <div className="glass-raised text-muted-foreground flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px]">
            <Sparkles className="text-primary size-3.5" /> earns XP
          </div>
        }
      />

      <div className="glass-raised inline-flex rounded-full p-1">
        {(
          [
            { id: "revision", label: "Revision decks", icon: GraduationCap },
            { id: "tutor", label: "Tutor (AI)", icon: BookOpen },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs transition-colors",
              tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "revision" ? <RevisionSection /> : <TutorSection />}
    </div>
  );
}

// ------------------------------------------------------------------ Revision

function RevisionSection() {
  const { profile, surgeActive } = useDimted();
  const progress = useStudyProgress(profile?.id);
  const save = useSaveAttempt(profile?.id);
  const refresh = useRefreshDimted();
  const { syncXp } = useDimted();
  const [subject, setSubject] = useState<(typeof SUBJECT_LIST)[number] | "All">("All");
  const [active, setActive] = useState<Deck | null>(null);

  const decks = useMemo(
    () => (subject === "All" ? DECKS : DECKS.filter((d) => d.subject === subject)),
    [subject],
  );
  const mastered = masteredCount(progress.data);

  const finish = useCallback(
    async (percent: number, correct: number, total: number) => {
      if (!profile) return;
      try {
        await save.mutateAsync({ deck: active!.id, percent });
      } catch {
        /* progress save is best-effort */
      }
      try {
        // Score scales with accuracy so a real effort pays more than a guess-spam.
        const score = Math.round(percent * 12 + correct * 40);
        const res = await awardArcadeXp("revision-quiz" as never, score);
        if (res.status === "awarded" || res.status === "granted") {
          syncXp(res, "revision quiz");
          toast.success(
            `+${res.gained} XP · +${res.sparks_gained} sparks for ${correct}/${total}` +
              (surgeActive ? " · surge doubled" : ""),
          );
          refresh();
        } else if (res.status === "cooldown") {
          toast("Result saved. XP again in under a minute.");
        } else if (res.status === "capped") {
          toast("Result saved — you've maxed today's XP from games and quizzes.");
        }
      } catch {
        toast("Result saved.");
      }
    },
    [active, profile, refresh, save, surgeActive, syncXp],
  );

  if (active) {
    return (
      <Panel className="p-5">
        <RevisionQuiz
          deck={active}
          onFinish={(pct, correct, total) => void finish(pct, correct, total)}
          onExit={() => setActive(null)}
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel className="p-4 sm:p-5">
        <PanelHead
          eyebrow="Revision"
          title="Year 9 Australian Curriculum"
          aside={`${mastered}/${DECKS.length} mastered`}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(["All", ...SUBJECT_LIST] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
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
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Every question has a worked explanation. Score 80% or higher to master a deck. These run
          entirely on-device, so they still work if the AI tutor is unavailable.
        </p>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {decks.map((d, i) => {
          const best = bestFor(progress.data, d.id);
          return (
            <button
              key={d.id}
              onClick={() => setActive(d)}
              className="glass animate-rise hover:bg-secondary/40 rounded-2xl p-4 text-left transition-colors"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="eyebrow">{d.subject}</p>
                  <h3 className="font-display mt-1 text-base leading-snug font-semibold tracking-tight">
                    {d.name}
                  </h3>
                </div>
                {best > 0 ? (
                  <span
                    className={cn(
                      "numeral shrink-0 text-sm",
                      best >= 80 ? "text-gold" : "text-muted-foreground",
                    )}
                  >
                    {best}%
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{d.blurb}</p>
              <p className="text-muted-foreground mt-3 font-mono text-[10px]">
                {d.questions.length} questions · {d.strand}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- Tutor

function TutorSection() {
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
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-primary/15 border-primary/30 border"
                      : "glass-raised border-border border",
                  )}
                >
                  {m.role === "assistant" ? <p className="eyebrow mb-1.5">Tutor</p> : null}
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
