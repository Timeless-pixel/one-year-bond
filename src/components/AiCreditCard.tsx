import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAiCreditStatus } from "@/lib/admin.functions";

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : "None recorded");

/** Admin-only. Renders nothing for everyone else. Always refetched — no cached balance. */
export function AiCreditCard() {
  const fetchStatus = useServerFn(getAiCreditStatus);
  const { data } = useQuery({
    queryKey: ["ai-credit-status"],
    queryFn: () => fetchStatus(),
    refetchInterval: 60_000,
    staleTime: 0,
    retry: false,
  });
  if (!data?.isAdmin) return null;

  const failingNow = !!data.lastFailAt && (!data.lastOkAt || data.lastFailAt > data.lastOkAt);
  const status = data.exhausted
    ? "Out of credits — replies and portraits are failing"
    : failingNow && data.lastFailStatus === "rate_limited"
      ? "Rate-limited by the AI service"
      : failingNow
        ? "AI requests are failing"
        : "Working normally";

  return (
    <div className={`glass mb-8 rounded-2xl p-5 ${data.exhausted || failingNow ? "border border-destructive/60" : ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin · AI service</div>
      <div className={`mt-1 text-lg ${failingNow ? "text-destructive" : ""}`}>{status}</div>
      {data.exhausted && (
        <p className="mt-1 text-xs text-muted-foreground">
          Top up or upgrade in your workspace settings (Plans &amp; credits).
        </p>
      )}

      <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        <Row k="AI provider" v={data.provider} />
        <Row k="Model" v={data.model} />
        <Row k="Credits remaining" v="Credit balance unavailable" />
        <Row k="Credit limit / reset" v="Shown in workspace settings" />
        <Row k="Last successful AI request" v={fmt(data.lastOkAt)} />
        <Row k="Last failed AI request" v={fmt(data.lastFailAt)} />
        <Row k="Error code" v={data.lastErrorCode ?? "—"} />
        <Row k="Last error" v={data.lastErrorDetail ?? "—"} />
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Replies today" value={data.chatToday} />
        <Stat label="Replies this month" value={data.chatMonth} />
        <Stat label="Portraits today" value={data.portraitToday} />
        <Stat label="Portraits this month" value={data.portraitMonth} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate text-right" title={v}>{v}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <div className="text-xl">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
