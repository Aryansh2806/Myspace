import { createClient } from "@supabase/supabase-js";

// Service-role key: server-side only. Never import this from a client component.
export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export type Priority = "high" | "normal" | "low";

export type Task = {
  id: string;
  title: string;
  client: string | null;
  due_at: string | null;
  source: string | null;
  source_kind: string | null;
  status: "open" | "done" | "dropped";
  priority: Priority;
  position: number | null;
  done_at: string | null;
  created_at: string;
};

export type Language = "english" | "hinglish" | "hindi";

export type Client = {
  id: string;
  name: string;
  is_self: boolean;
  voice: string | null;
  audience: string | null;
  pillars: string[] | null;
  tone_do: string[] | null;
  tone_dont: string[] | null;
  colours: string[] | null;
  links: { instagram?: string | null; linkedin?: string | null; website?: string | null } | null;
  language: Language;
  notes: string | null;
  market: Market | null;
  competitor_notes: string | null;
  created_at: string;
};

export type Market = {
  category: string;
  competitors: { name: string; positions_on: string; weakness: string }[];
  cliches: string[];
  openings: { opening: string; why_now: string }[];
  confidence: "high" | "medium" | "low";
};

export type Platform = "instagram" | "linkedin";
export type PostFormat = "post" | "reel" | "carousel" | "story" | "article";
export type PostStatus = "draft" | "approved" | "posted";

export type Post = {
  id: string;
  client_id: string;
  platform: Platform;
  format: PostFormat;
  pillar: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string[] | null;
  image_prompt: string | null;
  cta: string | null;
  scheduled_at: string | null;
  status: PostStatus;
  posted_at: string | null;
  position: number | null;
  created_at: string;
};
