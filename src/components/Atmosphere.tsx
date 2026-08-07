import { useEffect, useMemo, useState } from "react";
import { currentAtmosphere } from "@/lib/emotion-shared";

/**
 * A subtle, time- and season-aware wash behind the whole app. Never animated
 * aggressively and never on top of content — it only shifts the atmosphere.
 */
export function Atmosphere({ enabled = true }: { enabled?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const atmo = useMemo(() => (now ? currentAtmosphere(now) : null), [now]);

  if (!enabled || !atmo) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 transition-[background] duration-1000"
      style={{ background: atmo.gradient }}
    />
  );
}

export function useAtmosphereLabel() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    setLabel(currentAtmosphere().label);
  }, []);
  return label;
}
