ALTER TABLE public.messages
ADD COLUMN edited_at timestamp with time zone;

DROP POLICY IF EXISTS "Users manage their own messages" ON public.messages;

CREATE POLICY "Users can read their own messages"
ON public.messages
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can edit their own user messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND role = 'user')
WITH CHECK (auth.uid() = user_id AND role = 'user');

CREATE POLICY "Users can delete their own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);