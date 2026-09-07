import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const LANGUAGES = new Set(["english", "hinglish", "hindi"]);

/** Supabase returns text[] as an array; anything else from a client is coerced. */
const strings = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : null;

const clean = (c: any) => ({
  name: String(c.name ?? "").trim(),
  is_self: c.is_self === true,
  voice: c.voice?.trim() || null,
  audience: c.audience?.trim() || null,
  pillars: strings(c.pillars),
  tone_do: strings(c.tone_do),
  tone_dont: strings(c.tone_dont),
  colours: strings(c.colours),
  links: c.links && typeof c.links === "object" ? c.links : null,
  language: LANGUAGES.has(c.language) ? c.language : "english",
  notes: c.notes?.trim() || null,
});

export async function GET() {
  const { data, error } = await db.from("clients").select("*").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const rows = (Array.isArray(body) ? body : [body]).map(clean).filter((c) => c.name);
  if (!rows.length) return NextResponse.json({ error: "A brand needs a name." }, { status: 400 });

  const { data, error } = await db.from("clients").insert(rows).select();
  if (error) {
    // 23505 is the unique index on lower(name) or the single is_self row.
    if (error.code === "23505") {
      const which = error.message.includes("clients_self_idx")
        ? "You already have a personal brand. Edit that one instead."
        : "A brand with that name already exists.";
      return NextResponse.json({ error: which }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowed = [
    "name", "is_self", "voice", "audience", "pillars",
    "tone_do", "tone_dont", "colours", "links", "language", "notes",
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (!(k in fields)) continue;
    const v = fields[k];
    if (k === "pillars" || k === "tone_do" || k === "tone_dont" || k === "colours") patch[k] = strings(v);
    else if (k === "language") patch[k] = LANGUAGES.has(v) ? v : "english";
    else patch[k] = v === "" ? null : v;
  }
  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { data, error } = await db.from("clients").update(patch).eq("id", id).select().single();
  if (error) {
    if (error.code === "23505")
      return NextResponse.json({ error: "That name is already taken." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

/** Hard delete — posts cascade. The UI confirms first; there is no undo here. */
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await db.from("clients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
