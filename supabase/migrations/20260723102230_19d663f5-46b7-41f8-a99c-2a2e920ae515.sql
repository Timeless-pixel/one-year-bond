CREATE TABLE public.image_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id UUID NULL REFERENCES public.characters(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX image_generations_user_created_idx
  ON public.image_generations (user_id, created_at DESC);

GRANT SELECT ON public.image_generations TO authenticated;
GRANT ALL ON public.image_generations TO service_role;

ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generations"
  ON public.image_generations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER image_generations_set_updated_at
  BEFORE UPDATE ON public.image_generations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();