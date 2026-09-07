import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// The DB has a check constraint; this keeps a bad value from becoming a 500.
const PRIORITIES = new Set(["high", "normal", "low"]);

export async function GET() {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .neq("status", "dropped")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Accepts one task or an array (the review screen saves in bulk).
export async function POST(req: Request) {
  const body = await req.json();
  const rows = (Array.isArray(body) ? body : [body])
    .map((t) => ({
      title: String(t.title ?? "").trim(),
      client: t.client?.trim() || null,
      due_at: t.due_at || null,
      source: t.source ?? null,
      source_kind: t.source_kind ?? "note",
      priority: PRIORITIES.has(t.priority) ? t.priority : "normal",
    }))
    .filter((t) => t.title);

  if (!rows.length) return NextResponse.json({ error: "no titles" }, { status: 400 });

  const { data, error } = await db.from("tasks").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const allowed = ["title", "client", "due_at", "status", "priority"] as const;
  const patch = Object.fromEntries(
    allowed.filter((k) => k in fields).map((k) => [k, fields[k] === "" ? null : fields[k]]),
  );
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  const { data, error } = await db.from("tasks").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await db.from("tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
