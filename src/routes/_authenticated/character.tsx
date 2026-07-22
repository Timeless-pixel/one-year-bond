import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCharacter } from "@/lib/character.functions";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/character")({
  component: CharacterPage,
  head: () => ({
    meta: [
      { title: "Character — Lumen" },
      { name: "description", content: "Your companion profile." },
    ],
  }),
});

function CharacterPage() {
  const fetchCharacter = useServerFn(getMyCharacter);
  const { data: c } = useQuery({ queryKey: ["character"], queryFn: () => fetchCharacter() });

  if (!c) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          No character yet.
        </div>
      </AppShell>
    );
  }

  const traits: string[] = (c.personality as { traits?: string[] } | null)?.traits ?? [];
  const interests: string[] = (c.interests as { list?: string[] } | null)?.list ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="glass overflow-hidden rounded-3xl">
          <div
            className="aspect-[16/9] w-full"
            style={{
              background: c.avatar_url
                ? `center/cover url(${c.avatar_url})`
                : "var(--gradient-primary)",
            }}
          />
          <div className="p-7">
            <h1 className="text-4xl">{c.name}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {c.style} · {c.relationship_type} · {c.relationship_stage}
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Info label="Age" value={c.age} />
              <Info label="Gender" value={c.gender} />
              <Info label="Pronouns" value={c.pronouns} />
              <Info label="Occupation" value={c.occupation} />
              <Info label="Location" value={c.location} />
              <Info label="Communication" value={c.communication_style} />
            </div>

            {c.backstory && (
              <Section title="Backstory">
                <p className="text-sm leading-relaxed text-muted-foreground">{c.backstory}</p>
              </Section>
            )}
            {c.goals && (
              <Section title="Goals">
                <p className="text-sm text-muted-foreground">{c.goals}</p>
              </Section>
            )}
            {traits.length > 0 && (
              <Section title="Personality">
                <div className="flex flex-wrap gap-2">
                  {traits.map((t) => (
                    <span key={t} className="rounded-full border border-border px-3 py-1 text-xs">{t}</span>
                  ))}
                </div>
              </Section>
            )}
            {interests.length > 0 && (
              <Section title="Interests">
                <div className="flex flex-wrap gap-2">
                  {interests.map((t) => (
                    <span key={t} className="rounded-full border border-border px-3 py-1 text-xs">{t}</span>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
