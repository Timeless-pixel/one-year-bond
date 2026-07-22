
-- Characters table (one per user - enforced by unique constraint)
CREATE TABLE public.characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  style TEXT NOT NULL,
  age TEXT,
  gender TEXT,
  pronouns TEXT,
  occupation TEXT,
  location TEXT,
  appearance JSONB DEFAULT '{}'::jsonb,
  personality JSONB DEFAULT '{}'::jsonb,
  backstory TEXT,
  interests JSONB DEFAULT '{}'::jsonb,
  relationship_type TEXT NOT NULL DEFAULT 'Friend',
  communication_style TEXT DEFAULT 'Casual',
  goals TEXT,
  avatar_url TEXT,
  mood TEXT DEFAULT 'Curious',
  relationship_stage TEXT DEFAULT 'Stranger',
  journey_start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  journey_end_date TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '365 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_character_per_user UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.characters TO authenticated;
GRANT ALL ON public.characters TO service_role;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own character" ON public.characters
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own messages" ON public.messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX messages_character_created_idx ON public.messages(character_id, created_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER characters_set_updated_at BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
