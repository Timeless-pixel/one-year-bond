CREATE OR REPLACE FUNCTION public.bond_signal_counts(p_character_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT json_build_object(
    'memories', (SELECT count(*) FROM public.memories m WHERE m.character_id = p_character_id AND m.user_id = auth.uid() AND m.category <> 'character'),
    'scenarios', (SELECT count(*) FROM public.story_events s WHERE s.character_id = p_character_id AND s.user_id = auth.uid()),
    'milestones', (SELECT count(*) FROM public.milestones ms WHERE ms.character_id = p_character_id AND ms.user_id = auth.uid()),
    'messages', (SELECT count(*) FROM public.messages ms2 WHERE ms2.character_id = p_character_id AND ms2.user_id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.bond_signal_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bond_signal_counts(uuid) TO service_role;