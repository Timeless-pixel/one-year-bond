import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getBondExperience, updateBondSettings, updateLoveLanguage, deleteBond } from "@/lib/bond.functions";
import { getChatUsage } from "@/lib/character.functions";
import { UsageMeter, useCountdown } from "@/components/ChatLimit";
import { formatClock, formatCountdown, type ChatLimitState } from "@/lib/chat-limits";
import { useActiveBondId, setActiveBondId } from "@/hooks/useActiveBond";
import {
  DEFAULT_BOND_SETTINGS,
  LOVE_LANGUAGES,
  type ActionIntensity,
  type BondSettings,
} from "@/lib/emotion-shared";
import { journeyLabel } from "@/lib/scene-shared";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Bond settings — Lumen" },
      { name: "description", content: "Tune how your companion expresses themselves, moves and reaches out." },
      { property: "og:title", content: "Bond settings — Lumen" },
      { property: "og:description", content: "Tune how your companion expresses themselves, moves and reaches out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SettingsPage() {
  const [characterId] = useActiveBondId();
  const qc = useQueryClient();
  const fetchExperience = useServerFn(getBondExperience);
  const saveSettings = useServerFn(updateBondSettings);
  const saveLoveLanguage = useServerFn(updateLoveLanguage);
  const fetchUsage = useServerFn(getChatUsage);

  const { data: usage } = useQuery({
    queryKey: ["chat-usage"],
    queryFn: () => fetchUsage(),
    refetchOnWindowFocus: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["bond-experience", characterId],
    queryFn: () => fetchExperience({ data: { characterId } }),
  });

  const settings: BondSettings = data?.settings ?? DEFAULT_BOND_SETTINGS;

  const mut = useMutation({
    mutationFn: (patch: Partial<BondSettings>) =>
      saveSettings({ data: { characterId, ...patch } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["bond-experience"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const llMut = useMutation({
    mutationFn: (loveLanguage: (typeof LOVE_LANGUAGES)[number]) =>
      saveLoveLanguage({ data: { characterId, loveLanguage } }),
    onSuccess: () => {
      toast.success("Saved.");
      void qc.invalidateQueries({ queryKey: ["bond-experience"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-4xl">
          {data.name}&apos;s <span className="text-gradient italic">settings</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {journeyLabel(data.day)}
        </p>

        <Section title="Presence">
          <Toggle
            label="Physical actions"
            hint="Body language and small movements woven into replies."
            value={settings.actions}
            onChange={(v) => mut.mutate({ actions: v })}
          />
          <div className="py-3">
            <div className="text-sm">Action intensity</div>
            <div className="mt-2 flex gap-2">
              {(["subtle", "balanced", "vivid"] as ActionIntensity[]).map((i) => (
                <button
                  key={i}
                  onClick={() => mut.mutate({ actionIntensity: i })}
                  disabled={!settings.actions}
                  className={`rounded-xl border px-3 py-1.5 text-xs capitalize transition disabled:opacity-40 ${
                    settings.actionIntensity === i
                      ? "border-primary/60 bg-white/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Facial expressions"
            hint="Live expression glow and mood emoji in chat."
            value={settings.expressions}
            onChange={(v) => mut.mutate({ expressions: v })}
          />
          <div className="py-3">
            <div className="text-sm">Current scene</div>
            <p className="text-xs text-muted-foreground">Where the two of you are right now. They keep it in mind and change it naturally.</p>
            <input
              defaultValue={settings.scene ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (settings.scene ?? "")) mut.mutate({ scene: v || null });
              }}
              placeholder="a quiet café, rain outside"
              className="mt-2 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none"
            />
          </div>
        </Section>

        <Section title="Their own life">
          <Toggle
            label="They reach out first"
            hint="Occasional messages started by them when you've been away."
            value={settings.initiations}
            onChange={(v) => mut.mutate({ initiations: v })}
          />
          <Toggle
            label="Dreams"
            hint="They sometimes tell you about a dream they had."
            value={settings.dreams}
            onChange={(v) => mut.mutate({ dreams: v })}
          />
          <Toggle
            label="Pause this bond"
            hint="No living moments, dreams or messages while paused. Your history is untouched and time keeps counting."
            value={settings.paused}
            onChange={(v) => mut.mutate({ paused: v })}
          />
        </Section>

        <Section title="How they show care">
          <div className="flex flex-wrap gap-2 py-2">
            {LOVE_LANGUAGES.map((l) => (
              <button
                key={l}
                onClick={() => llMut.mutate(l)}
                className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                  data.loveLanguage === l
                    ? "border-primary/60 bg-white/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </Section>

        {usage && (
          <Section title="Chat usage">
            <div className="py-3">
              <UsageMeter state={usage as ChatLimitState} />
            </div>
            <Row label="Temporary cooldown">
              {usage.cooldownUntil ? <Cooldown until={usage.cooldownUntil} /> : "None"}
            </Row>
            <Row label="Daily reset">{formatClock(usage.resetAt)}</Row>
          </Section>
        )}

        <Section title="Interface & accessibility">
          <Toggle
            label="Quick interaction buttons"
            hint="Contextual suggestions under the message box."
            value={settings.quickButtons}
            onChange={(v) => mut.mutate({ quickButtons: v })}
          />
          <Toggle
            label="Animations"
            hint="Breathing portrait, typing indicator and fade-ins."
            value={settings.animations}
            onChange={(v) => mut.mutate({ animations: v })}
          />
          <Toggle
            label="Atmospheric backgrounds"
            hint="Background shifts with time of day and season."
            value={settings.backgrounds}
            onChange={(v) => mut.mutate({ backgrounds: v })}
          />
        </Section>

        {data.growthNotes.length > 0 && (
          <Section title="How they've changed with you">
            <ul className="space-y-2 py-2 text-sm text-muted-foreground">
              {data.growthNotes.map((g, i) => (
                <li key={i} className="border-l-2 border-primary/40 pl-3">
                  {g}
                </li>
              ))}
            </ul>
          </Section>
        )}
        {characterId && <ManageBond characterId={characterId} name={data.name} />}
      </div>
    </AppShell>
  );
}

function ManageBond({ characterId, name }: { characterId: string; name: string }) {
  const remove = useServerFn(deleteBond);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<"delete" | "replace" | null>(null);

  const mut = useMutation({
    mutationFn: (mode: "delete" | "replace") =>
      remove({ data: { characterId } }).then(() => mode),
    onSuccess: async (mode) => {
      setActiveBondId(null);
      qc.clear();
      setConfirm(null);
      if (mode === "replace") {
        toast.success(`${name} was deleted. Let's create your new bond.`);
        navigate({ to: "/create", replace: true });
      } else {
        toast.success(`${name} was permanently deleted.`);
        navigate({ to: "/bonds", replace: true });
      }
    },
    onError: (e: Error) => toast.error(e.message || "Something went wrong. Please try again."),
  });

  const copy =
    confirm === "replace"
      ? {
          title: "Replace Bond?",
          body: "Your current Bond will be permanently deleted, including its conversations, memories, relationship progress, and settings. You'll then be able to create a completely new Bond from scratch.",
          action: "Replace Bond",
          busy: "Replacing…",
        }
      : {
          title: "Delete Bond?",
          body: "Are you sure you want to permanently delete this Bond? All conversations, memories, relationship progress, settings, and associated data will be deleted.",
          action: "Delete Bond",
          busy: "Deleting…",
        };

  return (
    <>
      <Section title="Manage bond">
        <div className="flex items-start justify-between gap-4 py-3">
          <div>
            <div className="text-sm">Replace bond</div>
            <p className="text-xs text-muted-foreground">Delete {name} and start a brand-new bond from scratch.</p>
          </div>
          <button
            onClick={() => setConfirm("replace")}
            className="shrink-0 rounded-xl border border-destructive/50 px-3 py-1.5 text-xs text-destructive transition hover:bg-destructive/10"
          >
            Replace
          </button>
        </div>
        <div className="flex items-start justify-between gap-4 py-3">
          <div>
            <div className="text-sm">Delete bond</div>
            <p className="text-xs text-muted-foreground">Permanently remove {name} and everything you shared.</p>
          </div>
          <button
            onClick={() => setConfirm("delete")}
            className="shrink-0 rounded-xl bg-destructive px-3 py-1.5 text-xs text-destructive-foreground transition hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </Section>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => !mut.isPending && setConfirm(null)}
          />
          <div role="alertdialog" aria-modal className="glass relative w-full max-w-md rounded-3xl p-7">
            <h3 className="text-2xl">{copy.title}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{copy.body}</p>
            <p className="mt-3 text-sm font-medium text-destructive">This action cannot be undone.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                onClick={() => setConfirm(null)}
                disabled={mut.isPending}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => !mut.isPending && mut.mutate(confirm)}
                disabled={mut.isPending}
                className="flex-1 rounded-xl bg-destructive px-4 py-3 text-sm text-destructive-foreground disabled:opacity-60"
              >
                {mut.isPending ? copy.busy : copy.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass mt-6 rounded-3xl p-6">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-2 divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`mt-1 h-6 w-11 shrink-0 rounded-full p-0.5 transition ${value ? "bg-primary/70" : "bg-white/15"}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : ""}`}
        />
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <span>{label}</span>
      <span className="tabular-nums text-muted-foreground">{children}</span>
    </div>
  );
}

function Cooldown({ until }: { until: string }) {
  const { remaining, done } = useCountdown(until);
  if (done) return <>None</>;
  return (
    <>
      Active · {formatCountdown(remaining)} (around {formatClock(until)})
    </>
  );
}
