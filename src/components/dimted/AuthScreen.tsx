import { useState } from "react";
import { BrandLockup } from "./Brand";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Meter } from "./primitives";
import { UNLOCKS, XP_SOURCES } from "@/lib/dimted";

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
    <div className="grid min-h-screen items-center gap-8 p-4 lg:grid-cols-[1.05fr_minmax(0,420px)] lg:p-10">
      <div className="animate-rise max-w-xl">
        <BrandLockup size={44} className="[&_span:last-child]:text-xl" />
        <h1 className="font-display mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          A social world that levels up with you.
        </h1>
        <p className="text-muted-foreground mt-4 max-w-md text-sm leading-relaxed">
          Dimted is not a chat app with games bolted on. Talking to people <em>is</em> the game.
          Real conversations earn XP, XP raises your Level, and every Level opens something that was
          hidden before.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
              Everything you do earns XP — no caps, no cooldowns.
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
              Nothing here is purchasable. All of it is earned.
            </p>
          </div>
        </div>

        <div className="border-border bg-background/40 mt-6 rounded-2xl border p-4">
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

      <div className="glass-raised animate-rise rounded-3xl p-6" style={{ animationDelay: "80ms" }}>
        <p className="eyebrow">{mode === "signup" ? "Create your account" : "Welcome back"}</p>
        <h2 className="font-display mt-1.5 text-2xl font-semibold tracking-tight">
          {mode === "signup" ? "Start at Level 1" : "Sign in"}
        </h2>

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
  );
}
