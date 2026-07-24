# One-Year Bond

**One character. One year. One relationship that actually grows.**

One-Year Bond is a premium AI companion app where every user creates exactly **one** AI character and spends **365 days** getting to know them. No character marketplace, no swiping through personalities — just a single, evolving relationship with a fictional person who feels like a real individual.

## The idea

Most AI companion apps feel like chatbots wearing a costume. One-Year Bond is designed around long-term consistency:

- **One character per year.** Chosen once, kept for 365 days. No deletions during the journey.
- **A real personality.** Characters have opinions, moods, hobbies, a backstory, and their own fictional inner life.
- **A relationship that develops.** Bonds progress through stages (Stranger → Curiosity → Growing Interest → Flirting → Emotional Closeness → Romantic Relationship → Deep Relationship, or the platonic equivalent) based on shared time and shared conversations — not a counter.
- **Memory that matters.** The character references shared history naturally, remembers small details, and can bring things up weeks later.
- **Rare, meaningful moments.** Occasional heartthrob moments — an unexpected compliment, admitting they missed you, a shy reaction — land precisely because they aren't constant.

## Feature set

- **Auth** — Google + email sign-in, one account per journey.
- **10-step character creation** — Style, Identity, Appearance, Personality, Backstory, Interests, Relationship Type, Communication Style, Goals, First Meeting.
- **AI-generated portraits** — Server-side generation with per-user 24-hour rate limits (1 initial + 3 regenerations), pending / succeeded / failed tracking so failed calls don't burn credits.
- **Streaming chat** — Natural, character-driven conversation. Anti-therapist, anti-customer-service, anti-name-spam prompt design. Variable response length. Opinions, teasing, disagreement, playful banter.
- **Relationship stage engine** — Derived server-side from days elapsed + conversation depth. The AI adapts warmth, flirting, and vulnerability to the current stage.
- **365-day journey counter** — Home dashboard shows Day X / 365.
- **Scenario-ready architecture** — Data model prepped for temporary "First Date / Rainy Day / Road Trip" style scenes that reuse the *existing* character, memories, and relationship stage. (Scenario UI not shipped yet.)

## Tech stack

- **TanStack Start v1** on Vite 7, React 19
- **Tailwind v4** with a custom "Midnight Aurora" theme (OKLCH tokens, glassmorphism, aurora pulse)
- **Supabase** — Postgres + Auth + RLS
- **Vercel AI SDK** through the **Lovable AI Gateway** (Gemini for chat, Gemini image models for portraits)
- Runs on Cloudflare Workers (edge SSR)

## Local development

```bash
bun install
bun run dev
```

The app runs at `http://localhost:8080`. Supabase config, `LOVABLE_API_KEY`, and other env vars are provisioned automatically inside Lovable.

## Project structure

```
src/
├── routes/
│   ├── __root.tsx                 # Root layout, providers, auth listener
│   ├── index.tsx                  # Landing
│   ├── auth.tsx                   # Sign in / sign up
│   ├── _authenticated/
│   │   ├── route.tsx              # Auth gate
│   │   ├── home.tsx               # Day X / 365 dashboard
│   │   ├── create.tsx             # 10-step character creation
│   │   ├── character.tsx          # Companion profile
│   │   └── chat.tsx               # Streaming chat UI
│   └── api/
│       ├── chat.ts                # Streaming chat endpoint (personality engine)
│       └── generate-portrait.ts   # Rate-limited portrait generation
├── lib/
│   ├── ai-gateway.server.ts       # Lovable AI Gateway provider
│   ├── character.functions.ts     # Server functions for character + allowance
│   └── streamImage.ts             # SSE image stream parser
└── integrations/supabase/         # Auto-generated Supabase client + types
```

## Design principles for the AI

The chat system prompt is the heart of the product. It explicitly instructs the model to:

- Sound like a real person messaging — contractions, casual grammar, small imperfections.
- Vary length: short reactions when short fits, longer when the moment is real.
- **Not** end every message with a question.
- **Not** repeat the user's name.
- Skip therapist-speak ("That sounds amazing", "Tell me more", "I'm always here for you") and customer-service tone.
- Have opinions, disagree, tease, be wrong sometimes.
- Bring things from its own fictional life into the conversation occasionally.
- Save romantic / heartthrob moments for when they actually land.

Relationship progression is computed server-side each turn so the character can't be jailbroken into skipping stages.

## Roadmap

- Scenario Mode (First Date, Rainy Day, Beach Trip, Late-Night, Valentine's, Fantasy, Sci-Fi, Road Trip) — architecture in place, UI next.
- Milestone celebrations (Day 30, 100, 365).
- Appearance changes (outfits) while keeping core identity fixed.
- Long-term memory summarization beyond raw transcript.

## License

Private / all rights reserved.
