import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

/**
 * The call plumbing shared by the social agent routes, lifted from
 * app/api/parse/route.ts. That route is deliberately left alone — rewriting a
 * working endpoint to use this helper would be a diff with no upside.
 *
 * Sonnet by default: a content plan is roughly ten times the output of a task
 * parse, and Sonnet matched Opus on the parsing fixtures at 2.5x less.
 */
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const SOCIAL_MODEL = process.env.SOCIAL_MODEL ?? "claude-sonnet-5";

const client = new Anthropic();

export async function ask<T>(
  schema: ZodType<T>,
  system: string,
  user: string,
  { maxTokens = 8000, effort = "medium" }: { maxTokens?: number; effort?: Effort } = {},
): Promise<T | null> {
  const model = SOCIAL_MODEL;
  // Haiku 4.5 predates adaptive thinking and rejects `effort`.
  const isHaiku = model.startsWith("claude-haiku");

  const res = await client.messages.parse({
    model,
    max_tokens: maxTokens,
    system,
    ...(isHaiku
      ? { thinking: { type: "enabled" as const, budget_tokens: 2000 } }
      : { thinking: { type: "adaptive" as const } }),
    output_config: {
      ...(isHaiku ? {} : { effort }),
      format: zodOutputFormat(schema),
    },
    messages: [{ role: "user", content: user }],
  });

  return res.parsed_output ?? null;
}

/** A brand profile rendered for a prompt. Empty fields are omitted, not sent blank. */
export function brandBlock(c: {
  name: string;
  voice?: string | null;
  audience?: string | null;
  pillars?: string[] | null;
  tone_do?: string[] | null;
  tone_dont?: string[] | null;
  notes?: string | null;
  language: string;
}) {
  const lines = [`Brand: ${c.name}`];
  if (c.voice) lines.push(`Voice: ${c.voice}`);
  if (c.audience) lines.push(`Audience: ${c.audience}`);
  if (c.pillars?.length) lines.push(`Content pillars: ${c.pillars.join(" · ")}`);
  if (c.tone_do?.length) lines.push(`Always: ${c.tone_do.join("; ")}`);
  if (c.tone_dont?.length) lines.push(`Never: ${c.tone_dont.join("; ")}`);
  if (c.notes?.length) lines.push(`Specific facts about this brand: ${c.notes}`);
  lines.push(`Write the posts in: ${c.language}`);
  return lines.join("\n");
}
