// Client-safe constants and helpers for the multi-bond system.

export const MAX_ACTIVE_BONDS = 3;

export interface BondSummary {
  id: string;
  name: string;
  style: string;
  avatar_url: string | null;
  mood: string | null;
  relationship_type: string;
  relationship_stage: string | null;
  status: string;
  journey_start_date: string;
  last_active_at: string;
  archived_at: string | null;
  farewell_message: string | null;
  living_moments_enabled: boolean;
  message_count?: number;
  memory_count?: number;
  keepsake_count?: number;
}

export interface LivingMoment {
  id: string;
  character_id: string;
  kind: string;
  content: string;
  day: number;
  status: string;
  created_at: string;
}

export interface Keepsake {
  id: string;
  character_id: string;
  title: string;
  note: string | null;
  icon: string;
  day: number;
  created_at: string;
}

export interface Letter {
  id: string;
  character_id: string;
  occasion: string;
  title: string;
  body: string;
  day: number;
  read_at: string | null;
  created_at: string;
}

export function computeDay(startDate: string) {
  const day =
    Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000) + 1;
  return Math.max(1, Math.min(365, day));
}

export function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const m = Math.floor(d / 30);
  return m === 1 ? "a month ago" : `${m} months ago`;
}

export const MOMENT_KIND_LABEL: Record<string, string> = {
  moment: "A small moment",
  thought: "Thinking of you",
  surprise: "A surprise",
  event: "Something happened",
};
