ALTER TABLE public.characters DROP CONSTRAINT IF EXISTS one_character_per_user;

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS farewell_message text,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS living_moments_enabled boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS characters_user_status_idx ON public.characters(user_id, status, last_active_at DESC);

CREATE TABLE IF NOT EXISTS public.living_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'moment',
  content text NOT NULL,
  day integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.living_moments TO authenticated;
GRANT ALL ON public.living_moments TO service_role;
ALTER TABLE public.living_moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own living moments" ON public.living_moments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS living_moments_char_idx ON public.living_moments(character_id, created_at DESC);
CREATE TRIGGER living_moments_set_updated_at BEFORE UPDATE ON public.living_moments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.keepsakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  story_event_id uuid REFERENCES public.story_events(id) ON DELETE SET NULL,
  title text NOT NULL,
  note text,
  icon text NOT NULL DEFAULT 'sparkles',
  day integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.keepsakes TO authenticated;
GRANT ALL ON public.keepsakes TO service_role;
ALTER TABLE public.keepsakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own keepsakes" ON public.keepsakes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS keepsakes_char_idx ON public.keepsakes(character_id, created_at DESC);
CREATE TRIGGER keepsakes_set_updated_at BEFORE UPDATE ON public.keepsakes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  occasion text NOT NULL DEFAULT 'milestone',
  title text NOT NULL,
  body text NOT NULL,
  day integer NOT NULL DEFAULT 1,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letters TO authenticated;
GRANT ALL ON public.letters TO service_role;
ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own letters" ON public.letters FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS letters_unique_occasion ON public.letters(character_id, occasion, day);
CREATE TRIGGER letters_set_updated_at BEFORE UPDATE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();