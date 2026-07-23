import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateCharacterInput = z.object({
  name: z.string().min(1).max(60),
  style: z.string(),
  age: z.string().optional().default(""),
  gender: z.string().optional().default(""),
  pronouns: z.string().optional().default(""),
  occupation: z.string().optional().default(""),
  location: z.string().optional().default(""),
  appearance: z.record(z.string(), z.any()).default({}),
  personality: z.array(z.string()).default([]),
  backstory: z.string().max(2000).default(""),
  interests: z.array(z.string()).default([]),
  relationship_type: z.string().default("Friend"),
  communication_style: z.string().default("Casual"),
  goals: z.string().max(1000).default(""),
  avatar_url: z.string().optional(),
});

export const createCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateCharacterInput.parse(input))
  .handler(async ({ data, context }) => {
    const existing = await context.supabase
      .from("characters")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing.data) {
      throw new Error("You already have a companion for this year's journey.");
    }

    const { data: character, error } = await context.supabase
      .from("characters")
      .insert({
        user_id: context.userId,
        name: data.name,
        style: data.style,
        age: data.age || null,
        gender: data.gender || null,
        pronouns: data.pronouns || null,
        occupation: data.occupation || null,
        location: data.location || null,
        appearance: data.appearance,
        personality: { traits: data.personality },
        backstory: data.backstory || null,
        interests: { list: data.interests },
        relationship_type: data.relationship_type,
        communication_style: data.communication_style,
        goals: data.goals || null,
        mood: "Curious",
        relationship_stage: "Stranger",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return character;
  });

export const getMyCharacter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("characters")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ avatarUrl: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("characters")
      .update({ avatar_url: data.avatarUrl })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const PORTRAIT_DAILY_LIMIT = 4;

export const getPortraitAllowance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await context.supabase
      .from("image_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "succeeded")
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    const used = count ?? 0;
    return { used, remaining: Math.max(0, PORTRAIT_DAILY_LIMIT - used), limit: PORTRAIT_DAILY_LIMIT };
  });

