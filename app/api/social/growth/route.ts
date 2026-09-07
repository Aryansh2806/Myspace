import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { ask, brandBlock } from "@/lib/claude";
import { nowLabel } from "@/lib/due.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TZ = "Asia/Kolkata";

const Growth = z.object({
  ideas: z.array(
    z.object({
      title: z.string().describe("The idea in a few words, as an action"),
      what: z.string().describe("What to actually do, concretely, in two or three sentences"),
      why: z.string().describe("Why this works for THIS brand's audience specifically"),
      effort: z
        .enum(["quick", "medium", "ongoing"])
        .describe("quick = under an hour; medium = a day; ongoing = a habit to keep up"),
      verify: z
        .boolean()
        .describe(
          "true when this depends on how the platform currently behaves — ranking, reach, " +
            "a feature that may have changed. false for advice that is about people, not algorithms.",
        ),
    }),
  ),
});

function systemPrompt(brand: string, platform: string, hasPosts: number) {
  return `You advise a small Indian branding studio on growing a client's presence.
Right now it is ${nowLabel(new Date(), TZ)} in ${TZ}.

${brand}

Give ideas for ${platform === "instagram" ? "Instagram" : "LinkedIn"}.
${hasPosts ? `This brand already has ${hasPosts} posts queued or published, so do not suggest "start posting".` : ""}

Rules:
- Every idea must be something this brand could do THIS WEEK with what it already
  has. No "hire a videographer", no "run a campaign", no budget assumptions.
- Ground each idea in the brand's own pillars, audience and facts above. An idea
  that would fit any other business in this industry is not worth listing.
- Say plainly what to do. "Post three carousels breaking down a site survey" is
  an idea; "increase engagement" is not.
- Be honest in "why". If an idea is a reasonable bet rather than a certainty,
  say so.
- Set verify = true whenever the idea leans on current platform behaviour —
  reach, ranking, what a format is favoured right now. Your knowledge of those
  is months out of date and the reader needs to know which claims to check.
- Six to eight ideas. Fewer good ones beats a long list.`;
}

export async function POST(req: Request) {
  const { client_id, platform = "instagram" } = await req.json();
  if (!client_id) return NextResponse.json({ error: "Pick a brand first." }, { status: 400 });
  if (!["instagram", "linkedin"].includes(platform))
    return NextResponse.json({ error: "Unknown platform." }, { status: 400 });

  const { data: client, error } = await db.from("clients").select("*").eq("id", client_id).single();
  if (error || !client)
    return NextResponse.json({ error: error?.message ?? "Brand not found." }, { status: 404 });

  const { count } = await db
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client_id);

  try {
    const out = await ask(
      Growth,
      systemPrompt(brandBlock(client), platform, count ?? 0),
      `Ideas for growing ${client.name} on ${platform}.`,
      { maxTokens: 8000, effort: "medium" },
    );
    if (!out?.ideas?.length)
      return NextResponse.json({ error: "No ideas came back." }, { status: 502 });
    return NextResponse.json({ ideas: out.ideas, platform });
  } catch (e: any) {
    console.error("growth failed", e);
    return NextResponse.json({ error: e?.message ?? "growth failed" }, { status: 502 });
  }
}
