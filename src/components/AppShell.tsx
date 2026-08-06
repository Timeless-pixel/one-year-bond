import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, MessageCircle, Sparkles, LogOut, Brain, BookHeart, Clapperboard, Library, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { BondSwitcher } from "@/components/BondSwitcher";
import type { ReactNode } from "react";

const nav = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/scenarios", label: "Scenarios", icon: Clapperboard },
  { to: "/memories", label: "Memories", icon: Brain },
  { to: "/story", label: "Our Story", icon: BookHeart },
  { to: "/keepsakes", label: "Keepsakes", icon: Gift },
  { to: "/character", label: "Character", icon: Sparkles },
  { to: "/bonds", label: "Bonds", icon: Library },
] as const;

const mobileNav = nav.filter((n) =>
  ["/home", "/chat", "/scenarios", "/story", "/bonds"].includes(n.to),
);



export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="glass fixed inset-y-4 left-4 hidden w-56 flex-col rounded-3xl p-5 md:flex">
        <Link to="/home" className="mb-5 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg" style={{ background: "var(--gradient-primary)" }} />
          <span className="text-lg font-semibold">Lumen</span>
        </Link>
        <div className="mb-4">
          <BondSwitcher />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((n) => {
            const active = loc.pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={signOut}
          className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      <main className="pb-24 md:ml-64 md:pb-4">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="glass fixed inset-x-4 bottom-4 flex items-center justify-around rounded-2xl px-2 py-2 md:hidden">
        {mobileNav.map((n) => {
          const active = loc.pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] transition ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}

            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
