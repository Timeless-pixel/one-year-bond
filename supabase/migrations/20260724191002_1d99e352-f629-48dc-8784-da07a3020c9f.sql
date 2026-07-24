
CREATE TABLE public.memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  importance SMALLINT NOT NULL DEFAULT 3,
  source TEXT NOT NULL DEFAULT 'auto',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memories" ON public.memories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX memories_user_created_idx ON public.memories(user_id, created_at DESC);
CREATE TRIGGER memories_set_updated_at BEFORE UPDATE ON public.memories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.conversation_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  summary TEXT NOT NULL,
  message_count_at INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_summaries TO authenticated;
GRANT ALL ON public.conversation_summaries TO service_role;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own summaries" ON public.conversation_summaries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX conv_sum_user_created_idx ON public.conversation_summaries(user_id, created_at DESC);
CREATE TRIGGER conv_sum_set_updated_at BEFORE UPDATE ON public.conversation_summaries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  character_id UUID NOT NULL,
  day INTEGER NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own milestones" ON public.milestones FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX milestones_user_day_idx ON public.milestones(user_id, day DESC);
