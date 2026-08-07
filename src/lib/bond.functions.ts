import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { MAX_ACTIVE_BONDS } from "@/lib/bond-shared";
import {
  normalizeSettings,
  relationshipLevel,
  expressionFromMood,
  isExpression,
  LOVE_LANGUAGES,
  type BondSettings,
} from "@/lib/emotion-shared";
import {
  resolveCharacter,
  generateLivingMoment,
  generateDream,
  generateInitiation,
  generateFarewell,
  generateLetter,
  milestoneTitle,
} from "@/lib/bond.server";

export const listBonds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("characters")
      .select(
        "id, name, style, avatar_url, mood, relationship_type, relationship_stage, status, journey_start_date, last_active_at, archived_at, farewell_message, living_moments_enabled",
      )
      .eq("user_id", context.userId)
      .order("last_active_at", { ascending: false });
    if (error) throw new Error(error.message);
    const bonds = data ?? [];

    const counts = await Promise.all(
      bonds.map(async (b) => {
        const [msgs, mems, keeps] = await Promise.all([
          context.supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", context.userId)
            .eq("character_id", b.id),
          context.supabase
            .from("memories")
            .select("id", { count: "exact", head: true })
            .eq("user_id", context.userId)
            .eq("character_id", b.id)
            .neq("category", "character"),
          context.supabase
            .from("keepsakes")
            .select("id", { count: "exact", head: true })
            .eq("user_id", context.userId)
            .eq("character_id", b.id),
        ]);
        return {
          ...b,
          message_count: msgs.count ?? 0,
          memory_count: mems.count ?? 0,
          keepsake_count: keeps.count ?? 0,
        };
      }),
    );

    const active = counts.filter((b) => b.status === "active");
    return {
      bonds: counts,
      activeCount: active.length,
      slotsLeft: Math.max(0, MAX_ACTIVE_BONDS - active.length),
      max: MAX_ACTIVE_BONDS,
    };
  });

export const touchBond = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ characterId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("characters")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", data.characterId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const archiveBond = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ characterId: z.string().uuid(), reason: z.string().max(300).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase
      .from("characters")
      .select("*")
      .eq("id", data.characterId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!c) throw new Error("Bond not found.");
    if (c.status === "archived") return { farewell: c.farewell_message ?? "" };

    const day = Math.max(
      1,
      Math.floor((Date.now() - new Date(c.journey_start_date).getTime()) / 86_400_000) + 1,
    );

    const { data: mems } = await context.supabase
      .from("memories")
      .select("content")
      .eq("user_id", context.userId)
      .eq("character_id", c.id)
      .order("importance", { ascending: false })
      .limit(12);

    const ctx = (mems ?? []).map((m) => `- ${m.content}`).join("\n");
    const farewell =
      (await generateFarewell(c, day, ctx)) ??
      `Thank you for these ${day} days. I'll keep them. — ${c.name}`;

    const { error } = await context.supabase
      .from("characters")
      .update({
        status: "archived",
        archived_at: new Date().toISOString(),
        farewell_message: farewell,
      })
      .eq("id", c.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("story_events").insert({
      user_id: context.userId,
      character_id: c.id,
      kind: "farewell",
      title: `Farewell to ${c.name}`,
      description: farewell,
      day,
    });

    return { farewell };
  });

export const restoreBond = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ characterId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("characters")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "active");
    if ((count ?? 0) >= MAX_ACTIVE_BONDS) {
      throw new Error(
        `You can hold ${MAX_ACTIVE_BONDS} active bonds at a time. Archive one first.`,
      );
    }
    const { error } = await context.supabase
      .from("characters")
      .update({
        status: "active",
        archived_at: null,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", data.characterId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------- Living moments --------------------

export const getLivingMoments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ characterId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId);
    if (!c) return [];
    const { data: rows } = await context.supabase
      .from("living_moments")
      .select("*")
      .eq("user_id", context.userId)
      .eq("character_id", c.id)
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(3);
    return rows ?? [];
  });

/** Generates at most one new moment per 6h of absence, on demand. */
export const refreshLivingMoments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ characterId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase
      .from("characters")
      .select("*")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("last_active_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const character = data.characterId
      ? (
          await context.supabase
            .from("characters")
            .select("*")
            .eq("id", data.characterId)
            .eq("user_id", context.userId)
            .maybeSingle()
        ).data
      : c;
    if (!character || character.status !== "active") return { created: 0 };
    if (character.living_moments_enabled === false) return { created: 0 };

    const { data: last } = await context.supabase
      .from("living_moments")
      .select("created_at, status")
      .eq("user_id", context.userId)
      .eq("character_id", character.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const hoursSinceLast = last
      ? (Date.now() - new Date(last.created_at).getTime()) / 3_600_000
      : 999;
    if (hoursSinceLast < 6) return { created: 0 };

    const { count: unread } = await context.supabase
      .from("living_moments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("character_id", character.id)
      .eq("status", "new");
    if ((unread ?? 0) >= 3) return { created: 0 };

    const hoursAway = Math.min(
      72,
      (Date.now() - new Date(character.last_active_at).getTime()) / 3_600_000,
    );
    const day = Math.max(
      1,
      Math.floor((Date.now() - new Date(character.journey_start_date).getTime()) / 86_400_000) + 1,
    );

    const { data: mems } = await context.supabase
      .from("memories")
      .select("content")
      .eq("user_id", context.userId)
      .eq("character_id", character.id)
      .order("importance", { ascending: false })
      .limit(8);

    const settings = normalizeSettings(character.settings);
    const memList = (mems ?? []).map((m) => m.content);
    const memContext = memList.map((m) => `- ${m}`).join("\n");

    // Occasionally the moment is a dream or the character opening a
    // conversation, when the user has those enabled.
    const roll = Math.random();
    let kind: string | null = null;
    let content: string | null = null;

    if (settings.dreams && roll < 0.18 && hoursAway >= 8) {
      content = await generateDream(character, day, memContext);
      kind = content ? "dream" : null;
    } else if (settings.initiations && roll < 0.42 && hoursAway >= 10) {
      content = await generateInitiation(character, day, memContext);
      kind = content ? "initiation" : null;
    }

    if (!kind || !content) {
      const moment = await generateLivingMoment(character, day, memList, hoursAway);
      if (!moment) return { created: 0 };
      kind = moment.kind;
      content = moment.content;
    }

    await context.supabase.from("living_moments").insert({
      user_id: context.userId,
      character_id: character.id,
      kind,
      content,
      day,
    });
    return { created: 1 };
  });

export const setLivingMomentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["seen", "dismissed", "kept"]) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("living_moments")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------- Keepsakes --------------------

export const listKeepsakes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ characterId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) return [];
    const { data: rows, error } = await context.supabase
      .from("keepsakes")
      .select("*")
      .eq("user_id", context.userId)
      .eq("character_id", c.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createKeepsake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        characterId: z.string().uuid().optional(),
        title: z.string().min(1).max(120),
        note: z.string().max(600).optional(),
        icon: z.string().max(30).default("sparkles"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) throw new Error("No bond selected.");
    const day = Math.max(
      1,
      Math.floor((Date.now() - new Date(c.journey_start_date).getTime()) / 86_400_000) + 1,
    );
    const { data: row, error } = await context.supabase
      .from("keepsakes")
      .insert({
        user_id: context.userId,
        character_id: c.id,
        title: data.title,
        note: data.note || null,
        icon: data.icon,
        day,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteKeepsake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("keepsakes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------- Letters --------------------

export const listLetters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ characterId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) return [];
    const { data: rows, error } = await context.supabase
      .from("letters")
      .select("*")
      .eq("user_id", context.userId)
      .eq("character_id", c.id)
      .order("day", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const markLetterRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("letters")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });

/** Writes a milestone letter if today's milestone has none yet. */
export const ensureMilestoneLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ characterId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: character } = await context.supabase
      .from("characters")
      .select("*")
      .eq("id", (await resolveCharacter(context.supabase, context.userId, data.characterId))?.id ?? "")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!character || character.status !== "active") return { created: 0 };

    const day = Math.max(
      1,
      Math.floor((Date.now() - new Date(character.journey_start_date).getTime()) / 86_400_000) + 1,
    );
    const LETTER_DAYS = [7, 30, 100, 180, 365];
    const due = LETTER_DAYS.filter((d) => d <= day).pop();
    if (!due) return { created: 0 };

    const { data: existing } = await context.supabase
      .from("letters")
      .select("id")
      .eq("user_id", context.userId)
      .eq("character_id", character.id)
      .eq("day", due)
      .maybeSingle();
    if (existing) return { created: 0 };

    const { data: mems } = await context.supabase
      .from("memories")
      .select("content")
      .eq("user_id", context.userId)
      .eq("character_id", character.id)
      .order("importance", { ascending: false })
      .limit(12);

    const body = await generateLetter(
      character,
      due,
      milestoneTitle(due),
      (mems ?? []).map((m) => `- ${m.content}`).join("\n"),
    );
    if (!body) return { created: 0 };

    await context.supabase.from("letters").insert({
      user_id: context.userId,
      character_id: character.id,
      occasion: "milestone",
      title: milestoneTitle(due),
      body,
      day: due,
    });
    return { created: 1 };
  });

// -------------------- Emotional state, growth & settings --------------------

/**
 * Everything the UI needs to render the character's current emotional state:
 * expression, relationship level (multi-factor, not message count) and the
 * per-bond experience settings. Also persists a recomputed level.
 */
export const getBondExperience = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ characterId: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const resolved = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!resolved) return null;

    const { data: c } = await context.supabase
      .from("characters")
      .select("*")
      .eq("id", resolved.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!c) return null;

    const [msgs, mems, scenes, stones] = await Promise.all([
      context.supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("character_id", c.id),
      context.supabase
        .from("memories")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("character_id", c.id)
        .neq("category", "character"),
      context.supabase
        .from("story_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("character_id", c.id),
      context.supabase
        .from("milestones")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("character_id", c.id),
    ]);

    const days = Math.max(
      1,
      Math.floor((Date.now() - new Date(c.journey_start_date).getTime()) / 86_400_000) + 1,
    );
    const level = relationshipLevel(c.relationship_type, {
      days,
      messages: msgs.count ?? 0,
      memories: mems.count ?? 0,
      scenarios: scenes.count ?? 0,
      milestones: stones.count ?? 0,
      trust: c.trust ?? 0,
    });

    if (c.relationship_stage !== level.stage || c.relationship_score !== level.score) {
      await context.supabase
        .from("characters")
        .update({ relationship_stage: level.stage, relationship_score: level.score })
        .eq("id", c.id)
        .eq("user_id", context.userId);
    }

    const expression = isExpression(c.expression) ? c.expression : expressionFromMood(c.mood);

    return {
      characterId: c.id,
      name: c.name as string,
      mood: (c.mood as string | null) ?? null,
      expression,
      loveLanguage: (c.love_language as string | null) ?? null,
      growthNotes: Array.isArray(c.growth_notes) ? (c.growth_notes as string[]) : [],
      settings: normalizeSettings(c.settings),
      level,
      day: days,
      signals: {
        messages: msgs.count ?? 0,
        memories: mems.count ?? 0,
        scenarios: scenes.count ?? 0,
        milestones: stones.count ?? 0,
      },
    };
  });

export const updateBondSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        characterId: z.string().uuid().optional(),
        initiations: z.boolean().optional(),
        dreams: z.boolean().optional(),
        backgrounds: z.boolean().optional(),
        expressions: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) throw new Error("No bond selected.");
    const { data: row } = await context.supabase
      .from("characters")
      .select("settings")
      .eq("id", c.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const current = normalizeSettings(row?.settings);
    const next: BondSettings = {
      initiations: data.initiations ?? current.initiations,
      dreams: data.dreams ?? current.dreams,
      backgrounds: data.backgrounds ?? current.backgrounds,
      expressions: data.expressions ?? current.expressions,
    };
    const { error } = await context.supabase
      .from("characters")
      .update({ settings: next as unknown as Record<string, boolean>, living_moments_enabled: next.initiations || next.dreams })
      .eq("id", c.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return next;
  });

export const updateLoveLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        characterId: z.string().uuid().optional(),
        loveLanguage: z.enum(LOVE_LANGUAGES),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const c = await resolveCharacter(context.supabase, context.userId, data.characterId, {
      includeArchived: true,
    });
    if (!c) throw new Error("No bond selected.");
    const { error } = await context.supabase
      .from("characters")
      .update({ love_language: data.loveLanguage })
      .eq("id", c.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
