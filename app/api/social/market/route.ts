import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { ask, brandBlock } from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Deliberately NOT web search. Measured: a live research call took 343s (past
 * Vercel's function ceiling), cost up to $0.47, and still declined to quote
 * competitor positioning it could not verify. The model's category knowledge
 * is instant and free, and what the user has actually seen beats both.
 */
const Market = z.object({
  category: z.string().describe("What business this really is, in the market's own words"),
  competitors: z
    .array(
      z.object({
        name: z.string().describe("A real company competing for this audience, national or regional"),
        positions_on: z.string().describe("What they lead with"),
        weakness: z.string().describe("What they are structurally bad at, which this brand could own"),
      }),
    )
    .describe("Four to six. Name real companies where you know them; say 'regional operators' where you do not."),
  cliches: z
    .array(z.string())
    .describe(
      "The exact phrases and post types EVERY brand in this category uses. This list is " +
        "used as a ban list when writing, so be specific and quote the phrasing.",
    ),
  openings: z
    .array(z.object({ opening: z.string(), why_now: z.string() }))
    .describe("Two to four positions this brand could credibly own that the competitors do not"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("How well you actually know this category. Be honest — low is a useful answer."),
});

export async function POST(req: Request) {
  const { client_id } = await req.json();
  if (!client_id) return NextResponse.json({ error: "Pick a brand first." }, { status: 400 });

  const { data: client, error } = await db.from("clients").select("*").eq("id", client_id).single();
  if (error || !client)
    return NextResponse.json({ error: error?.message ?? "Brand not found." }, { status: 404 });

  const seen = client.competitor_notes?.trim();

  try {
    const market = await ask(
      Market,
      `You map the competitive landscape for a small Indian branding studio so it can
position a client against it.

${brandBlock(client)}

Rules:
- Name real companies where you actually know them. Where you do not, say
  "regional operators" and describe the pattern rather than inventing a name.
  A made-up competitor is worse than none.
- "cliches" is the most useful field. List the phrases and post formats every
  brand in this category reaches for — they become a ban list when writing.
  Quote the actual phrasing: "committed to excellence", "your trusted partner".
- Openings must be credible for THIS brand given its facts, not generic
  differentiation advice.
- Set confidence honestly. You are working from training data with no live
  research, and a low-confidence answer the user can verify beats a confident
  invention.`,
      seen
        ? `The studio has seen these competitors first-hand — treat this as the most reliable input:\n${seen}`
        : "Map the landscape.",
      { maxTokens: 6000, effort: "medium" },
    );
    if (!market) return NextResponse.json({ error: "No analysis came back." }, { status: 502 });

    const { error: saveErr } = await db.from("clients").update({ market }).eq("id", client_id);
    if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 });
    return NextResponse.json({ market });
  } catch (e: any) {
    console.error("market failed", e);
    return NextResponse.json({ error: e?.message ?? "market failed" }, { status: 502 });
  }
}
