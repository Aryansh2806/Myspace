import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { selectDue, endOfDay } from "@/lib/due.mjs";

export const dynamic = "force-dynamic";

const TZ = "Asia/Kolkata";

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. This route is excluded
// from the password middleware, so the secret is its only door. Fails closed.
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return !process.env.VERCEL; // local: open, deployed: refuse
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("unauthorized", { status: 401 });

  const { data, error } = await db.from("tasks").select("*").eq("status", "open");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date();
  const due = selectDue(data, endOfDay(now, TZ));
  if (!due.length) return NextResponse.json({ sent: false, reason: "nothing due" });

  const overdue = due.filter((t) => new Date(t.due_at!) < now);
  const today = due.filter((t) => new Date(t.due_at!) >= now);
  const line = (t: (typeof due)[number]) =>
    `  ${time(t.due_at!)}  ${t.client ? `[${t.client}] ` : ""}${t.title}`;

  const body = [
    overdue.length && `OVERDUE (${overdue.length})\n${overdue.map(line).join("\n")}`,
    today.length && `TODAY (${today.length})\n${today.map(line).join("\n")}`,
    process.env.APP_URL ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const to = process.env.DIGEST_TO;
  if (!to || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ sent: false, reason: "email not configured", body });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.DIGEST_FROM ?? "My Todos <onboarding@resend.dev>",
      to,
      subject: `${due.length} due today${overdue.length ? ` — ${overdue.length} overdue` : ""}`,
      text: body,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("resend failed", res.status, detail);
    return NextResponse.json({ sent: false, error: detail }, { status: 502 });
  }
  return NextResponse.json({ sent: true, count: due.length });
}
