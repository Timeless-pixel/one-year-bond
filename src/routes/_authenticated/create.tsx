import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createCharacter, getMyCharacter, getPortraitAllowance } from "@/lib/character.functions";
import { streamImage } from "@/lib/streamImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/create")({
  component: CreatePage,
  head: () => ({
    meta: [
      { title: "Create your companion — Lumen" },
      { name: "description", content: "Bring your AI companion to life." },
    ],
  }),
});

const STYLES = ["Anime", "Realistic", "Fantasy", "Sci-Fi", "Cartoon"];
const TRAITS = [
  "Kind", "Playful", "Shy", "Confident", "Intelligent", "Sarcastic",
  "Mysterious", "Protective", "Energetic", "Calm", "Introverted", "Extroverted",
];
const RELATIONSHIPS = ["Friend", "Best Friend", "Romantic Partner", "Mentor", "Adventure Companion"];
const COMM_STYLES = ["Casual", "Formal", "Playful", "Flirty", "Sarcastic", "Supportive", "Energetic", "Calm"];
const HAIR_COLORS = ["Black", "Brown", "Blonde", "Red", "Silver", "White", "Blue", "Pink", "Purple"];
const EYE_COLORS = ["Brown", "Blue", "Green", "Hazel", "Amber", "Violet", "Grey"];

interface FormState {
  name: string;
  style: string;
  age: string;
  gender: string;
  pronouns: string;
  occupation: string;
  location: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  outfit: string;
  personality: string[];
  backstory: string;
  interests: string;
  relationship_type: string;
  communication_style: string;
  goals: string;
}

const initial: FormState = {
  name: "", style: "Anime", age: "", gender: "", pronouns: "", occupation: "", location: "",
  hair_color: "Silver", hair_style: "Long", eye_color: "Violet", outfit: "",
  personality: ["Kind"], backstory: "", interests: "",
  relationship_type: "Friend", communication_style: "Casual", goals: "",
};

function CreatePage() {
  const create = useServerFn(createCharacter);
  const fetchCharacter = useServerFn(getMyCharacter);
  const fetchAllowance = useServerFn(getPortraitAllowance);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [portrait, setPortrait] = useState<string | null>(null);
  const [portraitLoading, setPortraitLoading] = useState(false);
  const [portraitFinal, setPortraitFinal] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const existingQ = useQuery({
    queryKey: ["character"],
    queryFn: () => fetchCharacter(),
  });

  useEffect(() => {
    if (existingQ.data) navigate({ to: "/chat" });
  }, [existingQ.data, navigate]);

  const allowanceQ = useQuery({
    queryKey: ["portrait-allowance"],
    queryFn: () => fetchAllowance(),
    staleTime: 10_000,
    enabled: !existingQ.data,
  });

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggleTrait(t: string) {
    setForm((f) => ({
      ...f,
      personality: f.personality.includes(t)
        ? f.personality.filter((x) => x !== t)
        : [...f.personality, t],
    }));
  }

  const steps = ["Style", "Identity", "Appearance", "Personality", "Backstory", "Relationship", "Preview"];

  useEffect(() => {
    if (!portraitLoading) return;
    const messages = [
      "Bringing your companion to life…",
      "Creating their appearance…",
      "Adding the finishing touches…",
    ];
    let i = 0;
    setLoadingMsg(messages[0]);
    const t = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMsg(messages[i]);
    }, 2200);
    return () => clearInterval(t);
  }, [portraitLoading]);

  async function generatePortrait() {
    if (portraitLoading) return;
    setPortraitLoading(true);
    setPortraitFinal(false);
    setPortrait(null);
    const prompt = `Portrait of ${form.name || "a character"}, ${form.style} style. ${form.gender ? form.gender + ", " : ""}${form.age ? "age " + form.age + ", " : ""}${form.hair_color} ${form.hair_style} hair, ${form.eye_color} eyes${form.outfit ? ", wearing " + form.outfit : ""}. Beautiful lighting, cinematic composition, soft violet and cyan aurora backlight, portrait framing, high quality, detailed.`;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Please sign in again to generate your portrait.");
        return;
      }
      await streamImage(
        "/api/generate-portrait",
        prompt,
        (dataUrl, final) => {
          setPortrait(dataUrl);
          if (final) setPortraitFinal(true);
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      await qc.invalidateQueries({ queryKey: ["portrait-allowance"] });
    } catch (e) {
      setPortrait(null);
      setPortraitFinal(false);
      toast.error(
        e instanceof Error
          ? e.message
          : "Something went wrong while creating your companion's portrait. Your generation credit was not used. Please try again.",
      );
      await qc.invalidateQueries({ queryKey: ["portrait-allowance"] });
    } finally {
      setPortraitLoading(false);
    }
  }


  async function submit() {
    if (!form.name.trim()) {
      toast.error("Give your companion a name");
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      await create({
        data: {
          name: form.name.trim(),
          style: form.style,
          age: form.age, gender: form.gender, pronouns: form.pronouns,
          occupation: form.occupation, location: form.location,
          appearance: {
            hair_color: form.hair_color, hair_style: form.hair_style,
            eye_color: form.eye_color, outfit: form.outfit,
          },
          personality: form.personality,
          backstory: form.backstory,
          interests: form.interests
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          relationship_type: form.relationship_type,
          communication_style: form.communication_style,
          goals: form.goals,
          avatar_url: portrait && portraitFinal ? portrait : undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: ["character"] });
      toast.success(`${form.name} is here.`);
      navigate({ to: "/chat" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Step {step + 1} of {steps.length} · {steps[step]}
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${((step + 1) / steps.length) * 100}%`,
              background: "var(--gradient-primary)",
            }}
          />
        </div>
      </div>

      <div className="glass rounded-3xl p-8">
        {step === 0 && (
          <div>
            <h2 className="text-3xl">Choose their style</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The visual world your companion exists in.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => update("style", s)}
                  className={`rounded-2xl border p-6 text-left transition ${
                    form.style === s
                      ? "border-primary bg-white/10"
                      : "border-border hover:bg-white/5"
                  }`}
                >
                  <div className="text-lg">{s}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-3xl">Who are they?</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input className={inputCls} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Yuki" />
              </Field>
              <Field label="Age">
                <input className={inputCls} value={form.age} onChange={(e) => update("age", e.target.value)} placeholder="21" />
              </Field>
              <Field label="Gender">
                <input className={inputCls} value={form.gender} onChange={(e) => update("gender", e.target.value)} placeholder="Female" />
              </Field>
              <Field label="Pronouns">
                <input className={inputCls} value={form.pronouns} onChange={(e) => update("pronouns", e.target.value)} placeholder="she/her" />
              </Field>
              <Field label="Occupation">
                <input className={inputCls} value={form.occupation} onChange={(e) => update("occupation", e.target.value)} placeholder="Musician" />
              </Field>
              <Field label="Location">
                <input className={inputCls} value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Kyoto" />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-3xl">How do they look?</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Hair color">
                <SelectPills options={HAIR_COLORS} value={form.hair_color} onChange={(v) => update("hair_color", v)} />
              </Field>
              <Field label="Hair style">
                <input className={inputCls} value={form.hair_style} onChange={(e) => update("hair_style", e.target.value)} placeholder="Long, wavy" />
              </Field>
              <Field label="Eye color">
                <SelectPills options={EYE_COLORS} value={form.eye_color} onChange={(v) => update("eye_color", v)} />
              </Field>
              <Field label="Outfit / vibe">
                <input className={inputCls} value={form.outfit} onChange={(e) => update("outfit", e.target.value)} placeholder="cozy oversized sweater" />
              </Field>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-3xl">Personality</h2>
            <p className="mt-2 text-sm text-muted-foreground">Pick a few — combinations create depth.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {TRAITS.map((t) => {
                const on = form.personality.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTrait(t)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      on
                        ? "border-primary bg-primary/20 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <Field label="Communication style" className="mt-8">
              <SelectPills options={COMM_STYLES} value={form.communication_style} onChange={(v) => update("communication_style", v)} />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-3xl">Their backstory</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A few sentences. Where they come from. What they care about.
            </p>
            <textarea
              value={form.backstory}
              onChange={(e) => update("backstory", e.target.value)}
              rows={5}
              placeholder="Yuki grew up in a small town and dreams of becoming a musician. She's shy around strangers but very playful with people she trusts."
              className={`${inputCls} mt-6 resize-none`}
            />
            <Field label="Interests (comma separated)" className="mt-6">
              <input className={inputCls} value={form.interests} onChange={(e) => update("interests", e.target.value)} placeholder="lo-fi music, ramen, indie games" />
            </Field>
            <Field label="Their personal goal" className="mt-6">
              <input className={inputCls} value={form.goals} onChange={(e) => update("goals", e.target.value)} placeholder="Become a successful musician" />
            </Field>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-3xl">Your relationship</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This shapes how they'll relate to you across the year.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {RELATIONSHIPS.map((r) => (
                <button
                  key={r}
                  onClick={() => update("relationship_type", r)}
                  className={`rounded-2xl border p-5 text-left transition ${
                    form.relationship_type === r
                      ? "border-primary bg-white/10"
                      : "border-border hover:bg-white/5"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 className="text-3xl">Meet {form.name || "them"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your character portrait will be generated using AI based on the appearance and style you've created.
            </p>
            <div className="mt-6 flex flex-col items-center gap-5">
              <div
                className="relative aspect-square w-72 overflow-hidden rounded-3xl"
                style={{ background: "var(--gradient-primary)" }}
              >
                {portrait ? (
                  <img
                    src={portrait}
                    alt=""
                    className={`h-full w-full object-cover transition-[filter] duration-500 ${
                      portraitFinal ? "blur-0" : "blur-2xl"
                    }`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-display text-8xl italic text-white/60">
                    {form.name[0] || "?"}
                  </div>
                )}
                {portraitLoading && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/40 px-3 py-2 text-center text-xs text-white/90 backdrop-blur">
                    {loadingMsg}
                  </div>
                )}
              </div>
              {portrait && portraitFinal && !portraitLoading && (
                <div className="text-sm text-muted-foreground">Your companion is ready.</div>
              )}
              <button
                onClick={generatePortrait}
                disabled={portraitLoading || (allowanceQ.data?.remaining ?? 1) <= 0}
                className="glass rounded-full px-5 py-2 text-sm transition hover:brightness-125 disabled:opacity-60"
              >
                {portraitLoading ? "Painting…" : portrait ? "Regenerate portrait" : "Generate portrait"}
              </button>
              <div className="text-xs text-muted-foreground">
                {allowanceQ.data
                  ? `Portrait generations remaining today: ${allowanceQ.data.remaining} of ${allowanceQ.data.limit}`
                  : "Loading your generation allowance…"}
              </div>
            </div>
          </div>
        )}



        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-full px-5 py-2 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            ← Back
          </button>
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="btn-primary rounded-full px-6 py-2.5 text-sm font-medium"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting}
              className="btn-primary rounded-full px-6 py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? "Awakening…" : "Begin our journey"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-input px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function SelectPills({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${
            value === o
              ? "border-primary bg-primary/20 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
