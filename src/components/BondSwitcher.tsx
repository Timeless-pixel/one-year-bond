import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ChevronDown, Check, Plus, Library } from "lucide-react";
import { listBonds } from "@/lib/bond.functions";
import { useActiveBondId } from "@/hooks/useActiveBond";
import type { BondSummary } from "@/lib/bond-shared";

export function BondSwitcher() {
  const fetchBonds = useServerFn(listBonds);
  const [activeId, setActiveId] = useActiveBondId();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["bonds"],
    queryFn: () => fetchBonds(),
  });

  const bonds = (data?.bonds ?? []) as BondSummary[];
  const active = bonds.filter((b) => b.status === "active");
  const current = active.find((b) => b.id === activeId) ?? active[0];

  // Keep the stored selection valid (e.g. after archiving).
  useEffect(() => {
    if (current && activeId !== current.id) setActiveId(current.id);
  }, [current, activeId, setActiveId]);

  if (!current) return null;

  function pick(id: string) {
    setActiveId(id);
    setOpen(false);
    void qc.invalidateQueries();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="glass flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-white/5"
      >
        <Avatar bond={current} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{current.name}</span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {current.relationship_stage ?? current.relationship_type}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="glass absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl p-1">
            {active.map((b) => (
              <button
                key={b.id}
                onClick={() => pick(b.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-white/5"
              >
                <Avatar bond={b} />
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                {b.id === current.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            <div className="my-1 h-px bg-white/10" />
            <Link
              to="/bonds"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
            >
              <Library className="h-4 w-4" /> All bonds
            </Link>
            {(data?.slotsLeft ?? 0) > 0 && (
              <Link
                to="/create"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              >
                <Plus className="h-4 w-4" /> New bond
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ bond }: { bond: BondSummary }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-display italic text-white/80"
      style={{
        background: bond.avatar_url
          ? `center/cover url(${bond.avatar_url})`
          : "var(--gradient-primary)",
      }}
    >
      {!bond.avatar_url && bond.name[0]}
    </span>
  );
}
