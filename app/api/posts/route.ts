import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PLATFORMS = new Set(["instagram", "linkedin"]);
const FORMATS = new Set(["post", "reel", "carousel", "story", "article"]);
const STATUSES = new Set(["draft", "approved", "posted"]);

const strings = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => String(x).trim().replace(/^#/, "")).filter(Boolean) : null;

const clean = (p: any) => ({
  client_id: p.client_id,
  platform: PLATFORMS.has(p.platform) ? p.platform : "instagram",
  format: FORMATS.has(p.format) ? p.format : "post",
  pillar: p.pillar?.trim() || null,
  hook: p.hook?.trim() || null,
  caption: p.caption?.trim() || null,
  hashtags: strings(p.hashtags),
  image_prompt: p.image_prompt?.trim() || null,
  cta: p.cta?.trim() || null,
  scheduled_at: p.scheduled_at || null,
  status: STATUSES.has(p.status) ? p.status : "draft",
  position: Number.isFinite(p.position) ? p.position : null,
});

export async function GET(req: Request) {
  const clientId = new URL(req.url).searchParams.get("client_id");
  let q = db.from("posts").select("*");
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** One post or an array — the plan review saves in bulk, like /api/tasks. */
export async function POST(req: Request) {
  const body = await req.json();
  const rows = (Array.isArray(body) ? body : [body]).map(clean).filter((p) => p.client_id);
  if (!rows.length)
    return NextResponse.json({ error: "A post needs a client." }, { status: 400 });

  const { data, error } = await db.from("posts").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowed = [
    "platform", "format", "pillar", "hook", "caption", "hashtags",
    "image_prompt", "cta", "scheduled_at", "status", "position",
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (!(k in fields)) continue;
    const v = fields[k];
    if (k === "hashtags") patch[k] = strings(v);
    else if (k === "platform") patch[k] = PLATFORMS.has(v) ? v : "instagram";
    else if (k === "format") patch[k] = FORMATS.has(v) ? v : "post";
    else if (k === "status") patch[k] = STATUSES.has(v) ? v : "draft";
    else patch[k] = v === "" ? null : v;
  }

  // Stamped server-side, mirroring done_at on tasks: a client clock can be wrong.
  if (patch.status === "posted") patch.posted_at = new Date().toISOString();
  if (patch.status === "draft" || patch.status === "approved") patch.posted_at = null;

  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { data, error } = await db.from("posts").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await db.from("posts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
