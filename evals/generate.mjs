import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic();
const MODEL = process.env.SOCIAL_MODEL ?? "claude-sonnet-5";

const Plan = z.object({
  posts: z.array(
    z.object({
      platform: z.enum(["instagram", "linkedin"]),
      format: z.enum(["post", "reel", "carousel", "story", "article"]),
      pillar: z.string(),
      hook: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()),
      image_prompt: z.string(),
      cta: z.string(),
    }),
  ),
});

function brandBlock(b) {
  return [
    `Brand: ${b.name}`,
    `Voice: ${b.voice}`,
    `Audience: ${b.audience}`,
    `Content pillars: ${b.pillars.join(" · ")}`,
    `Always: ${b.tone_do.join("; ")}`,
    `Never: ${b.tone_dont.join("; ")}`,
    `Specific facts about this brand: ${b.notes}`,
    `Write the posts in: ${b.language}`,
  ].join("\n");
}

/**
 * Prompt variants under test. `baseline` is a faithful copy of what
 * app/api/social/plan/route.ts ships today, so a comparison is honest.
 */
export const VARIANTS = {
  baseline: (b, objective, n) => `You write social media content for a small Indian branding studio.

${brandBlock(b)}

Write ${n} posts across: instagram and linkedin.

Rules:
- Every post must name the brand pillar it serves, verbatim from the list above.
- The hook is the whole game. It must make sense with no context and give a
  reason to keep reading. Never open with "Excited to announce" or a greeting.
- Write for the platform. LinkedIn: a point of view, plain paragraphs, no emoji
  walls. Instagram: shorter, more direct.
- Use the brand's specifics. A caption that would fit any other company in this
  industry is a failed caption.
- Hashtags are nouns about this brand and its niche. Six to ten.`,

  objective: (b, objective, n) => `${VARIANTS.baseline(b, objective, n)}

THE POINT OF THIS BATCH
${objective}

Every post must advance that objective in a way you could defend. A post that is
merely on-brand but does nothing for the objective is filler — cut it and write
another. Prefer posts that give the reader a concrete reason to act now over
posts that build vague awareness.`,
};

export async function generate(variant, brand, objective, n = 6) {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: VARIANTS[variant](brand, objective, n),
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: zodOutputFormat(Plan) },
    messages: [{ role: "user", content: "Write the plan." }],
  });
  return res.parsed_output?.posts ?? [];
}
