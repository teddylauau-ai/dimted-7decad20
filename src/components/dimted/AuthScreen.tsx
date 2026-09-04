import { useEffect, useState } from "react";
import { BrandLockup } from "./Brand";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Meter } from "./primitives";
import { UNLOCKS, XP_SOURCES } from "@/lib/dimted";

const ROTATING = ["talk", "play", "climb", "unlock", "win"];

const PILLARS = [
  { title: "Chat that counts", body: "Every message, voice note and reply feeds your XP bar." },
  { title: "Pulse Rush", body: "15 hand-built rhythm levels, leaderboards and secret coins." },
  { title: "Earned, never bought", body: "Cosmetics, ranks and vaults come from playing — not paying." },
];

/**
 * Everyone starts at Level 1 with zero XP. There are no demo accounts and no
 * pre-made friends — the only people in Dimted are people who signed up.
 */
export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setWordIndex((i) => (i + 1) % ROTATING.length), 2200);
    return () => window.clearInterval(id);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account created — welcome to Level 1.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ambient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-primary/18 animate-breathe absolute -top-40 -left-32 h-[34rem] w-[34rem] rounded-full blur-[130px]" />
        <div
          className="bg-secret/14 animate-breathe absolute top-1/3 -right-40 h-[30rem] w-[30rem] rounded-full blur-[140px]"
          style={{ animationDelay: "2.5s" }}
        />
        <div className="bg-gold/10 absolute bottom-[-14rem] left-1/3 h-[26rem] w-[26rem] rounded-full blur-[150px]" />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in oklab, var(--foreground) 12%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 12%, transparent) 1px, transparent 1px)",
            backgroundSize: "68px 68px",
            maskImage: "radial-gradient(ellipse at 30% 25%, black, transparent 72%)",
          }}
        />
      </div>

      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-[1.1fr_minmax(0,400px)] lg:px-8">
        <div className="animate-rise">
          <div className="flex flex-wrap items-center gap-3">
            <BrandLockup size={40} className="[&_span:last-child]:text-lg" />
            <span className="border-hairline text-muted-foreground rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] uppercase">
              Level 1 · everyone starts here
            </span>
          </div>

          <h1 className="font-display mt-7 text-[2.6rem] leading-[1.02] font-semibold tracking-tight text-balance sm:text-6xl">
            The more you{" "}
            <span className="relative inline-grid align-baseline">
              {ROTATING.map((w, i) => (
                <span
                  key={w}
                  aria-hidden={i !== wordIndex}
                  className="text-primary text-glow col-start-1 row-start-1 transition-all duration-500"
                  style={{
                    opacity: i === wordIndex ? 1 : 0,
                    transform: i === wordIndex ? "translateY(0)" : "translateY(0.35em)",
                  }}
                >
                  {w}
                </span>
              ))}
              <span className="invisible col-start-1 row-start-1">unlock</span>
            </span>
            ,
            <br className="hidden sm:block" /> the further you get.
          </h1>

          <p className="text-muted-foreground mt-5 max-w-lg text-sm leading-relaxed sm:text-base">
            Dimted is a social world disguised as a game. Talk to people, run the arcade, clear Pulse
            Rush — it all pours into one XP bar that keeps opening things you couldn&apos;t see before.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {PILLARS.map((p, i) => (
              <div
                key={p.title}
                className="glass animate-rise hover:border-primary/30 rounded-2xl p-4 transition-colors"
                style={{ animationDelay: `${120 + i * 70}ms` }}
              >
                <p className="font-display text-sm font-semibold tracking-tight">{p.title}</p>
                <p className="text-muted-foreground mt-1.5 text-xs leading-snug">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="glass rounded-2xl p-4">
              <p className="eyebrow">Where XP comes from</p>
              <ul className="mt-3 space-y-1.5 text-xs">
                {XP_SOURCES.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3">
                    <span className="text-foreground/85">{s.label}</span>
                    <span className="text-primary shrink-0 font-mono text-[11px]">+{s.xp}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 text-[11px] leading-snug">
                No caps, no cooldowns — every action pays.
              </p>
            </div>
            <div className="glass rounded-2xl p-4">
              <p className="eyebrow">The ladder ahead</p>
              <ul className="mt-3 space-y-1.5 text-xs">
                {UNLOCKS.slice(0, 4).map((u) => (
                  <li key={u.level} className="flex items-baseline gap-2">
                    <span className="numeral text-gold w-8 shrink-0 text-sm">{u.level}</span>
                    <span className="text-foreground/85">{u.name}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-3 text-[11px] leading-snug">
                100 levels. Nothing purchasable — all of it earned.
              </p>
            </div>
          </div>

          <div className="border-hairline bg-background/40 mt-4 rounded-2xl border p-4">
            <div className="flex items-baseline justify-between">
              <span className="numeral text-2xl">1</span>
              <span className="text-muted-foreground font-mono text-[10px] tracking-[0.18em] uppercase">
                Newcomer
              </span>
            </div>
            <Meter value={0.02} tone="xp" className="mt-2" />
            <p className="text-muted-foreground mt-2 font-mono text-[10px]">
              0 / 260 XP — where everyone starts
            </p>
          </div>
        </div>

        <div
          className="glass-raised animate-rise glow-primary rounded-3xl p-6"
          style={{ animationDelay: "80ms" }}
        >
          <p className="eyebrow">{mode === "signup" ? "Create your account" : "Welcome back"}</p>
          <h2 className="font-display mt-1.5 text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Start at Level 1" : "Sign in"}
          </h2>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {mode === "signup"
              ? "Takes ten seconds. Your first XP lands on your first message."
              : "Pick up exactly where your ladder left off."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" ? (
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What people will call you"
                  autoComplete="nickname"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="text-muted-foreground my-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] uppercase">
            <span className="bg-border h-px flex-1" />
            or
            <span className="bg-border h-px flex-1" />
          </div>

          <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
            Continue with Google
          </Button>

          <p className="text-muted-foreground mt-6 text-center text-xs">
            {mode === "signup" ? "Already have an account?" : "New to Dimted?"}{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
