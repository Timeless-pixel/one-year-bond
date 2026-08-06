import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { MAX_ACTIVE_BONDS } from "@/lib/bond-shared";
import { resolveCharacter, milestoneTitle, milestoneCopy } from "@/lib/bond.server";

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

const BondInput = z.object({ characterId: z.string().uuid().optional() });

export const createCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateCharacterInput.parse(input))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("characters")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "active");
    if ((count ?? 0) >= MAX_ACTIVE_BONDS) {
      throw new Error(
        `You can hold ${MAX_ACTIVE_BONDS} active bonds at a time. Archive one before starting another.`,
      );
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
        avatar_url: data.avatar_url || null,
        mood: "Curious",
        relationship_stage: "Stranger",
        status: "active",
        last_active_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    // Seed character self-memories from creation input
    const charMems: string[] = [];
    if (data.backstory) charMems.push(`Backstory: ${data.backstory}`);
    if (data.goals) charMems.push(`Personal goal: ${data.goals}`);
    if (data.personality.length) charMems.push(`Personality: ${data.personality.join(", ")}`);
    if (data.interests.length) charMems.push(`Interests: ${data.interests.join(", ")}`);
    if (charMems.length) {
      await context.supabase.from("memories").insert(
        charMems.map((content) => ({
          user_id: context.userId,
          character_id: character.id,
          category: "character",
          content,
          importance: 5,
          source: "seed",
          pinned: true,
        })),
      );
    }

    await context.supabase.from("milestones").insert({
      user_id: context.userId,
      character_id: character.id,
      day: 1,
      kind: "day",
      title: "The journey begins",
      description: `You met ${character.name}.`,
    });

    return character;
  });

export const getMyCharacter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BondInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const resolved = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!resolved) return null;
    const { data: row, error } = await context.supabase
      .from("characters")
      .select("*")
      .eq("id", resolved.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ avatarUrl: z.string(), characterId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId);
    if (!c) throw new Error("No bond selected.");
    const { error } = await context.supabase
      .from("characters")
      .update({ avatar_url: data.avatarUrl })
      .eq("id", c.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMood = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ mood: z.string().min(1).max(40), characterId: z.string().uuid().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId);
    if (!c) throw new Error("No bond selected.");
    const { error } = await context.supabase
      .from("characters")
      .update({ mood: data.mood })
      .eq("id", c.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BondInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) return [];
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("user_id", context.userId)
      .eq("character_id", c.id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (rows ?? []).reverse();
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

// -------------------- Memories --------------------

const MEMORY_CATEGORIES = [
  "user", "preference", "event", "shared", "character", "goal",
  "likes", "moment", "relationship",
] as const;

export const listMemories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BondInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) return [];
    const { data: rows, error } = await context.supabase
      .from("memories")
      .select("*")
      .eq("user_id", context.userId)
      .eq("character_id", c.id)
      .order("pinned", { ascending: false })
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateMemoryInput = z.object({
  characterId: z.string().uuid().optional(),
  content: z.string().min(1).max(400),
  category: z.enum(MEMORY_CATEGORIES).default("user"),
  importance: z.number().int().min(1).max(5).default(3),
  pinned: z.boolean().default(false),
});

export const createMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateMemoryInput.parse(input))
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId);
    if (!c) throw new Error("No bond selected.");
    const { data: mem, error } = await context.supabase
      .from("memories")
      .insert({
        user_id: context.userId,
        character_id: c.id,
        content: data.content,
        category: data.category,
        importance: data.importance,
        pinned: data.pinned,
        source: "manual",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mem;
  });

const UpdateMemoryInput = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).max(400).optional(),
  category: z.enum(MEMORY_CATEGORIES).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  pinned: z.boolean().optional(),
});

export const updateMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateMemoryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase
      .from("memories")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("memories")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAllMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BondInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) return { ok: true };
    const { error } = await context.supabase
      .from("memories")
      .delete()
      .eq("user_id", context.userId)
      .eq("character_id", c.id)
      .neq("category", "character");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BondInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) return { ok: true };
    const { error } = await context.supabase
      .from("messages")
      .delete()
      .eq("user_id", context.userId)
      .eq("character_id", c.id);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("conversation_summaries")
      .delete()
      .eq("user_id", context.userId)
      .eq("character_id", c.id);
    return { ok: true };
  });

export const exportUserData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BondInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    const id = c?.id ?? "";
    const [character, memories, messages, milestones, summaries, keepsakes, letters] =
      await Promise.all([
        context.supabase.from("characters").select("*").eq("id", id).maybeSingle(),
        context.supabase.from("memories").select("*").eq("user_id", context.userId).eq("character_id", id),
        context.supabase
          .from("messages")
          .select("*")
          .eq("user_id", context.userId)
          .eq("character_id", id)
          .order("created_at"),
        context.supabase
          .from("milestones")
          .select("*")
          .eq("user_id", context.userId)
          .eq("character_id", id)
          .order("day"),
        context.supabase
          .from("conversation_summaries")
          .select("*")
          .eq("user_id", context.userId)
          .eq("character_id", id),
        context.supabase.from("keepsakes").select("*").eq("user_id", context.userId).eq("character_id", id),
        context.supabase.from("letters").select("*").eq("user_id", context.userId).eq("character_id", id),
      ]);
    return {
      exported_at: new Date().toISOString(),
      character: character.data,
      memories: memories.data ?? [],
      messages: messages.data ?? [],
      milestones: milestones.data ?? [],
      conversation_summaries: summaries.data ?? [],
      keepsakes: keepsakes.data ?? [],
      letters: letters.data ?? [],
    };
  });

// -------------------- Milestones / Story --------------------

export const listMilestones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BondInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) return [];
    const { data: rows, error } = await context.supabase
      .from("milestones")
      .select("*")
      .eq("user_id", context.userId)
      .eq("character_id", c.id)
      .order("day", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const checkMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BondInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const character = await resolveCharacter(context.supabase, context.userId, data.characterId);
    if (!character) return { created: 0 };
    const day = Math.max(
      1,
      Math.floor((Date.now() - new Date(character.journey_start_date).getTime()) / 86_400_000) + 1,
    );
    const eligible = [1, 7, 30, 60, 100, 180, 250, 365].filter((d) => d <= day);
    if (!eligible.length) return { created: 0 };
    const { data: existing } = await context.supabase
      .from("milestones")
      .select("day")
      .eq("user_id", context.userId)
      .eq("character_id", character.id)
      .eq("kind", "day")
      .in("day", eligible);
    const existingDays = new Set((existing ?? []).map((m) => m.day));
    const toCreate = eligible
      .filter((d) => !existingDays.has(d))
      .map((d) => ({
        user_id: context.userId,
        character_id: character.id,
        day: d,
        kind: "day",
        title: milestoneTitle(d),
        description: milestoneCopy(d, character.name),
      }));
    if (!toCreate.length) return { created: 0 };
    await context.supabase.from("milestones").insert(toCreate);
    return { created: toCreate.length };
  });
