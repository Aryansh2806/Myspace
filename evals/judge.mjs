import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();

/**
 * The rubric asks for evidence, not scores.
 *
 * A 1-10 "quality" score from an LLM judge drifts and flatters. Asking it to
 * QUOTE the brand-specific fact a post uses — or return null — is checkable:
 * either the quote is in the brand profile or it isn't. Same for filler, which
 * has to be quoted verbatim to count.
 */
const Verdict = z.object({
  brand_fact_used: z
    .string()
    .nullable()
    .describe(
      "Quote the specific fact from the brand profile this post relies on — a name, a " +
        "number, a product, a phrase. null if the post would read identically for any " +
        "other business in this category.",
    ),
  serves_pillar: z.boolean().describe("Does it genuinely serve the pillar it names?"),
  hook_works_alone: z
    .boolean()
    .describe("Does the first line make sense and earn a read with no other context?"),
  serves_objective: z.boolean().describe("Does this measurably advance the stated objective?"),
  filler: z
    .array(z.string())
    .describe("Quote any generic marketing phrases verbatim. Empty if there are none."),
  would_post: z
    .boolean()
    .describe(
      "Would a busy operator post this as-is, without editing? Be strict — this is the " +
        "number that matters and a generous answer makes the whole eval useless.",
    ),
});

export async function judge(brand, objective, post) {
  const res = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: zodOutputFormat(Verdict) },
    system:
      "You review draft social posts for a branding studio. You are the last gate before " +
      "something generic gets published under a client's name. Judge only what is in front " +
      "of you. Do not be encouraging.",
    messages: [
      {
        role: "user",
        content: `BRAND PROFILE
Name: ${brand.name}
Voice: ${brand.voice}
Audience: ${brand.audience}
Pillars: ${brand.pillars.join(" · ")}
Never: ${brand.tone_dont.join("; ")}
Facts: ${brand.notes}

OBJECTIVE FOR THIS BATCH
${objective}

DRAFT POST
Platform: ${post.platform} / ${post.format}
Pillar it claims: ${post.pillar}
Hook: ${post.hook}
Caption: ${post.caption}
Hashtags: ${(post.hashtags ?? []).join(" ")}`,
      },
    ],
  });
  return res.parsed_output;
}

/** Aggregate verdicts into the numbers worth comparing between variants. */
export function score(verdicts) {
  const n = verdicts.length || 1;
  const pct = (f) => Math.round((verdicts.filter(f).length / n) * 100);
  return {
    n: verdicts.length,
    wouldPost: pct((v) => v.would_post),
    usesBrandFact: pct((v) => v.brand_fact_used),
    servesPillar: pct((v) => v.serves_pillar),
    hookWorks: pct((v) => v.hook_works_alone),
    servesObjective: pct((v) => v.serves_objective),
    fillerPerPost: +(verdicts.reduce((a, v) => a + v.filler.length, 0) / n).toFixed(2),
  };
}
