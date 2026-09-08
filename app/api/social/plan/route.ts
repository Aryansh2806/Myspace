import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase";
import { ask, brandBlock, marketBlock } from "@/lib/claude";
import { nowLabel } from "@/lib/due.mjs";
import { spread } from "@/lib/calendar.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const TZ = "Asia/Kolkata";
const MAX_POSTS = 20; // a plan is ~10x a task parse; this is the bill cap

const Plan = z.object({
  posts: z.array(
    z.object({
      platform: z.enum(["instagram", "linkedin"]),
      format: z.enum(["post", "reel", "carousel", "story", "article"]),
      pillar: z.string().describe("Which of the brand's pillars this serves, quoted verbatim"),
      hook: z.string().describe("The first line. It has to work alone, before anyone taps 'more'."),
      caption: z.string().describe("The full caption, ready to paste. No placeholder brackets."),
      hashtags: z
        .array(z.string())
        .describe("Nouns about this brand and its niche. No leading #. No trend-chasing tags."),
      image_prompt: z
        .string()
        .describe(
          "A prompt for an image tool: subject, composition, lighting, mood. " +
            "No text overlays unless the post needs them.",
        ),
      cta: z.string().describe("What the reader should do next. One short line."),
      anchor_date: z
        .string()
        .nullable()
        .describe(
          "YYYY-MM-DD only when this post is pegged to a real date — a festival, a launch, " +
            "an event. Otherwise null; the app spreads the rest itself.",
        ),
      why: z.string().describe("One line: why this post earns attention for THIS brand"),
    }),
  ),
});

function systemPrompt(
  brand: string,
  market: string,
  objective: string,
  recent: string[],
  platforms: string[],
  count: number,
) {
  /* Measured at 78% would-post with an objective against 17% without, on the
     same brands. It is the single largest lever found so far. */
  const goal = objective?.trim()
    ? `\nTHE POINT OF THIS BATCH\n${objective.trim()}\n\nEvery post must advance that in a way you could defend to the client. A post\nthat is merely on-brand but does nothing for it is filler — cut it and write\nanother. Prefer a concrete reason to act now over vague awareness building.\n`
    : "";
  const avoid = recent.length
    ? `\nThis brand has already posted the captions below. Do not repeat these angles,
openings, claims or structures — find something it has not said yet:\n${recent
        .map((c, i) => `${i + 1}. ${c.slice(0, 220)}`)
        .join("\n")}\n`
    : "";

  return `You write social media content for a small Indian branding studio.
Right now it is ${nowLabel(new Date(), TZ)} in ${TZ}.

${brand}${market}
${goal}${avoid}
Write ${count} posts across: ${platforms.join(" and ")}.

Rules:
- Every post must name the brand pillar it serves, verbatim from the list above.
  If a post does not serve a pillar, do not write it.
- The hook is the whole game. It must make sense with no context and give a
  reason to keep reading. Never open with "Excited to announce" or a greeting.
- Write for the platform. LinkedIn: a point of view, plain paragraphs, no emoji
  walls. Instagram: shorter, more direct, line breaks that survive the preview.
- Use the brand's specifics — the names, products and facts above. A caption
  that would fit any other company in this industry is a failed caption.
- Hashtags are nouns about this brand and its niche. Six to ten. No
  generic filler like #love or #instagood.
- anchor_date only for posts genuinely tied to a date. Most posts are null.
- "why" is read by a human deciding whether to keep the draft. Be honest: if a
  post is a safe filler post, say so rather than overselling it.`;
}

export async function POST(req: Request) {
  const { client_id, count = 8, start, end, platforms = ["instagram"], brief, objective } = await req.json();
  if (!client_id) return NextResponse.json({ error: "Pick a brand first." }, { status: 400 });
  if (!start || !end) return NextResponse.json({ error: "Pick a date range." }, { status: 400 });

  const { data: client, error } = await db.from("clients").select("*").eq("id", client_id).single();
  if (error || !client)
    return NextResponse.json({ error: error?.message ?? "Brand not found." }, { status: 404 });

  // The strongest anti-generic lever there is, and it gets stronger every time
  // a post is marked posted.
  const { data: past } = await db
    .from("posts")
    .select("caption")
    .eq("client_id", client_id)
    .eq("status", "posted")
    .order("posted_at", { ascending: false })
    .limit(15);

  const n = Math.max(1, Math.min(MAX_POSTS, Number(count) || 8));
  const wanted = (Array.isArray(platforms) ? platforms : [platforms]).filter((p) =>
    ["instagram", "linkedin"].includes(p),
  );
  if (!wanted.length) wanted.push("instagram");

  try {
    const out = await ask(
      Plan,
      systemPrompt(
        brandBlock(client),
        marketBlock(client.market),
        objective ?? client.objective ?? "",
        (past ?? []).map((p) => p.caption).filter(Boolean) as string[],
        wanted,
        n,
      ),
      brief?.trim()
        ? `Extra direction for this batch: ${brief.trim()}`
        : "Write the plan.",
      { maxTokens: 16000, effort: "high" },
    );
    if (!out?.posts?.length)
      return NextResponse.json({ error: "The model returned no posts." }, { status: 502 });

    // Dates are assigned by code, never by the model.
    // Remember it as the brand's default for next time.
    if (objective?.trim() && objective.trim() !== client.objective)
      await db.from("clients").update({ objective: objective.trim() }).eq("id", client_id);

    const dated = spread(out.posts.slice(0, n), { start, end, hour: 11, tz: TZ });
    return NextResponse.json({ posts: dated, client: { id: client.id, name: client.name } });
  } catch (e: any) {
    console.error("plan failed", e);
    return NextResponse.json({ error: e?.message ?? "plan failed" }, { status: 502 });
  }
}
