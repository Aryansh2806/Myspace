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
  created_at: string;
};
