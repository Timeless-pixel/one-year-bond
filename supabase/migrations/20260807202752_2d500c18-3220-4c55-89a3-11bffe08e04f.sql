ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS expression TEXT NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS love_language TEXT,
  ADD COLUMN IF NOT EXISTS relationship_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS growth_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recent_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"initiations":true,"dreams":true,"backgrounds":true,"expressions":true}'::jsonb;