import { NextResponse } from "next/server";
import { z } from "zod";
import { ask } from "@/lib/claude";
import { nowLabel } from "@/lib/due.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TZ = "Asia/Kolkata";

const Brand = z.object({
  name: z.string().describe("The brand or client name"),
  voice: z.string().describe("How this brand sounds. Two or three concrete sentences."),
  audience: z.string().describe("Who it is talking to, specifically — not 'everyone'"),
  pillars: z.array(z.string()).describe("Three to five recurring content themes, 2-5 words each"),
  tone_do: z.array(z.string()).describe("Up to six concrete instructions for writing as this brand"),
  tone_dont: z.array(z.string()).describe("Up to six things this brand never says or does"),
  colours: z.array(z.string()).describe("Hex codes or colour names if mentioned, else empty"),
  links: z.object({
    instagram: z.string().nullable(),
    linkedin: z.string().nullable(),
    website: z.string().nullable(),
  }),
  language: z
    .enum(["english", "hinglish", "hindi"])
    .describe("The language this brand's own posts should be written in"),
  notes: z
    .string()
    .describe(
      "Specific facts worth remembering: people's names, actual products, locations, history, " +
        "phrases the client repeats. Empty string if the brief gave none.",
    ),
});

function systemPrompt() {
  return `You turn a spoken or written brief about a brand into a structured profile.
Right now it is ${nowLabel(new Date(), TZ)} in ${TZ}.

The brief may be an English, Hindi, or romanised Hinglish voice transcript, and may
switch between them mid-sentence. Read it in whatever script it arrives in.

Rules:
- Write the profile itself in English. The "language" field records what the
  brand's POSTS should be written in, which is a separate question — infer it
  from how the client talks about their audience, defaulting to english.
- Never invent facts. If the brief does not say who the audience is, write what
  can be inferred and keep it short rather than fabricating a persona.
- "notes" is the most valuable field. Put every specific in it: names, products,
  the founder's story, what they always say. Generic content later comes from an
  empty notes field, so capture anything concrete you heard.
- Pillars are what this brand posts about repeatedly, not marketing abstractions.
  "Site progress updates" is a pillar; "engagement" is not.
- tone_dont should be genuinely specific to this brand where the brief supports
  it. If it does not, leave it short.`;
}

export async function POST(req: Request) {
  const { text, name } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Say or write something first." }, { status: 400 });

  try {
    const profile = await ask(
      Brand,
      systemPrompt(),
      name ? `The brand is called "${name}".\n\n${text}` : text,
      { maxTokens: 4000 },
    );
    if (!profile) return NextResponse.json({ error: "Could not read that brief." }, { status: 502 });
    return NextResponse.json({ profile });
  } catch (e: any) {
    console.error("brief failed", e);
    return NextResponse.json({ error: e?.message ?? "brief failed" }, { status: 502 });
  }
}
