-- 1. Faster conversation pagination
CREATE INDEX IF NOT EXISTS messages_user_char_created_idx
  ON public.messages (user_id, character_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memories_user_char_idx
  ON public.memories (user_id, character_id, importance DESC);
CREATE INDEX IF NOT EXISTS conv_sum_user_char_idx
  ON public.conversation_summaries (user_id, character_id, message_count_at DESC);

-- 2. Bond-scoped people entities (relational memory)
CREATE TABLE IF NOT EXISTS public.bond_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_key text NOT NULL,
  relation text,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  emotional_note text,
  mentions integer NOT NULL DEFAULT 1,
  salience integer NOT NULL DEFAULT 1,
  last_mentioned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (character_id, name_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bond_people TO authenticated;
GRANT ALL ON public.bond_people TO service_role;
ALTER TABLE public.bond_people ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bond people" ON public.bond_people FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER bond_people_set_updated_at BEFORE UPDATE ON public.bond_people
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Internal emotional state + autonomy on each bond
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS emotion_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS emotion_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS autonomy text NOT NULL DEFAULT 'normal';

-- 4. Memory salience / decay support
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS person_key text;

-- 5. Account-level, backend-configurable chat allowance
CREATE TABLE IF NOT EXISTS public.account_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  daily_message_limit integer NOT NULL DEFAULT 300,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_limits TO authenticated;
GRANT ALL ON public.account_limits TO service_role;
ALTER TABLE public.account_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own limits" ON public.account_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE TRIGGER account_limits_set_updated_at BEFORE UPDATE ON public.account_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();