import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) navigate({ to: "/home" });
      else setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg" style={{ background: "var(--gradient-primary)" }} />
            <span className="text-lg font-semibold tracking-tight">Lumen</span>
          </div>
          <Link
            to="/auth"
            className="glass rounded-full px-4 py-2 text-sm transition hover:brightness-125"
          >
            Sign in
          </Link>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <div className="glass mb-8 rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            One character · One year · One relationship
          </div>
          <h1 className="max-w-3xl text-5xl leading-[1.05] sm:text-7xl">
            The AI companion you'll <span className="text-gradient italic">actually</span> get to know.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Create one character. Talk to them every day. Watch your relationship grow over a shared
            365-day journey — no marketplace, no swipes, no starting over.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="btn-primary rounded-full px-8 py-3 text-base font-medium hover:brightness-110"
            >
              Begin your journey
            </Link>
            <a
              href="#how"
              className="glass rounded-full px-6 py-3 text-base transition hover:brightness-125"
            >
              How it works
            </a>
          </div>

          <div id="how" className="mt-28 grid w-full gap-6 sm:grid-cols-3">
            {[
              { d: "01", t: "Create", b: "Bring a character to life — their style, personality, backstory, and how they speak to you." },
              { d: "02", t: "Chat", b: "Talk daily. They remember what matters — your goals, your dreams, your inside jokes." },
              { d: "03", t: "Grow", b: "Watch the relationship deepen through 365 days. Stranger, friend, close friend, and beyond." },
            ].map((s) => (
              <div key={s.d} className="glass rounded-2xl p-6 text-left">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.d}</div>
                <h3 className="mt-3 text-2xl">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.b}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="py-6 text-center text-xs text-muted-foreground">
          Your companion is an AI character created by you.
        </footer>
      </div>
    </div>
  );
}
