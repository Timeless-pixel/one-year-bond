import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAiCreditStatus } from "@/lib/admin.functions";

const fmt = (s: string | null) => {
  if (!s) return "None recorded";
  const date = new Date(s);
  return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : `${date.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
};

/** Admin-only. Renders nothing for everyone else. Always refetched — no cached balance. */
export function AiCreditCard() {
  const fetchStatus = useServerFn(getAiCreditStatus);
  const { data, isError, dataUpdatedAt } = useQuery({
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
        : data.lastOkAt
          ? "Working normally"
          : "No successful AI requests recorded yet";

  return (
    <div className={`glass mb-8 rounded-2xl p-5 ${data.exhausted || failingNow ? "border border-destructive/60" : ""}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin · AI service</div>
      <div className={`mt-1 break-words text-lg ${data.exhausted || failingNow ? "text-destructive" : ""}`}>{status}</div>
      <p className="mt-1 text-xs text-muted-foreground" role={isError ? "status" : undefined}>
        {isError
          ? "Unable to refresh AI status. Showing the last successful check."
          : `Last checked: ${fmt(dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null)}`}
      </p>
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
        <Row k="Error code" v={data.lastErrorCode || (data.lastFailAt ? "Not recorded" : "None recorded")} />
        <Row k="Last error" v={data.lastErrorDetail || (data.lastFailAt ? "Failure recorded without error details" : "None recorded")} fullWidth />
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Successful replies today" value={data.chatToday} />
        <Stat label="Successful replies this month" value={data.chatMonth} />
        <Stat label="Successful portraits today" value={data.portraitToday} />
        <Stat label="Successful portraits this month" value={data.portraitMonth} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Usage periods reset at midnight UTC. Counts include recorded activity only.</p>
    </div>
  );
}

function Row({ k, v, fullWidth = false }: { k: string; v: string; fullWidth?: boolean }) {
  return (
    <div className={`grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-3 border-b border-border/40 py-1.5 ${fullWidth ? "sm:col-span-2" : ""}`}>
      <dt className="min-w-0 break-words text-muted-foreground">{k}</dt>
      <dd className="min-w-0 whitespace-pre-wrap text-right [overflow-wrap:anywhere]">{v}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <div className="break-words text-xl tabular-nums">{value.toLocaleString()}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
