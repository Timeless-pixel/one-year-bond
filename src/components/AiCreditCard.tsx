import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAiCreditStatus } from "@/lib/admin.functions";

/** Admin-only. Renders nothing for everyone else. */
export function AiCreditCard() {
  const fetchStatus = useServerFn(getAiCreditStatus);
  const { data } = useQuery({
    queryKey: ["ai-credit-status"],
    queryFn: () => fetchStatus(),
    refetchInterval: 60_000,
    retry: false,
  });
  if (!data?.isAdmin) return null;

  const warning = !data.exhausted && data.failuresLastHour > 0;
  return (
    <div
      className={`glass mb-8 rounded-2xl p-5 ${data.exhausted ? "border border-destructive/60" : warning ? "border border-accent/60" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin · AI service</div>
          <div className={`mt-1 text-lg ${data.exhausted ? "text-destructive" : ""}`}>
            {data.exhausted
              ? "Out of credits — replies and portraits are failing"
              : warning
                ? "Credit refusals in the last hour — top up soon"
                : "Working normally"}
          </div>
          {data.exhausted && (
            <p className="mt-1 text-xs text-muted-foreground">
              Top up in your workspace settings. Last refusal{" "}
              {new Date(data.lastExhaustedAt!).toLocaleString()}.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Replies today" value={data.chatToday} />
        <Stat label="Replies this month" value={data.chatMonth} />
        <Stat label="Portraits today" value={data.portraitToday} />
        <Stat label="Portraits this month" value={data.portraitMonth} />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Exact credit balance is only shown in your workspace settings.
      </p>
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
