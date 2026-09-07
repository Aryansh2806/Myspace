import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { parseWhatsApp, chunk } from "@/lib/whatsapp.mjs";
import { nowLabel } from "@/lib/due.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TZ = "Asia/Kolkata";
// Swap models without a code change. Haiku is ~5x cheaper than Opus but weaker
// at exactly what this job is: resolving relative dates and judging what is
// actually actionable. See README -> Costs.
const MODEL = process.env.PARSE_MODEL ?? "claude-opus-5";
const IS_HAIKU = MODEL.startsWith("claude-haiku");
// ponytail: hard cap so one huge export can't quietly run up a bill.
const MAX_CHUNKS = 15;

const Result = z.object({
  tasks: z.array(
    z.object({
      title: z.string().describe("Imperative, one line. What Aryan has to do."),
      client: z.string().nullable().describe("Person or company who wants it, else null"),
      due_at: z.string().nullable().describe("ISO 8601 with offset, else null"),
      source: z.string().describe("The message text this came from, verbatim"),
      priority: z
        .enum(["high", "normal", "low"])
        .describe("high only when the sender signalled urgency; otherwise normal"),
    }),
  ),
});

const client = new Anthropic();

function systemPrompt() {
  return `You extract action items from messages Aryan received from clients.
Right now it is ${nowLabel(new Date(), TZ)} in ${TZ}. Resolve every relative date
against that, and emit ISO 8601 with the +05:30 offset.

Rules:
- Only extract things Aryan must DO. Skip greetings, acknowledgements, gossip,
  status updates, and anything the other person is doing themselves.
- Chat messages are prefixed with when they were SENT, as [YYYY-MM-DDTHH:MM].
  Resolve a message's relative dates against ITS OWN timestamp, not against now —
  "kal" in a message sent three days ago is not tomorrow. Pasted text with no
  such prefix resolves against now.
- The text may be English, Hindi in Devanagari, romanised Hinglish, or one
  sentence that switches between them — it is often a voice transcript. Read it
  whatever script it arrives in, and always write the task itself in English.
- Resolve "by Friday", "EOD tomorrow", "next week", "month end", and Hinglish
  forms ("kal", "parso", "agle hafte", "15 tarikh", "iss weekend") and their
  Devanagari equivalents (कल, परसों, अगले हफ्ते, इस हफ्ते) into real timestamps.
- A voice transcript has no punctuation to lean on and may contain filler
  ("umm", "matlab", "haan to"). Ignore the filler; several tasks may run
  together in one breath, so split them.
  "kal" is ambiguous (yesterday/tomorrow) — in a request it means tomorrow.
- A date with no time means 18:00 local. No date at all means null. Never invent one.
- title is imperative and self-contained: "Send Rahul the logo source files",
  not "logo files".
- client is who the work is for. Prefer the company name over the person's name
  when the message gives both, so the same client groups together across messages.
  Fall back to the sender's name when there is no company.
- source is the verbatim message the task came from, so Aryan can check it.
- priority is "high" ONLY when the sender actually signalled urgency — "urgent",
  "asap", "immediately", "jaldi", "turant", an explicit escalation, or a same-day
  deadline. "low" for explicit "whenever", "no rush", "baad mein", "koi jaldi
  nahi". Everything else is "normal". A polite deadline is not urgency; if you
  mark everything high, nothing is high.
- If nothing is actionable, return an empty tasks array. That is a normal answer.`;
}

async function extract(userText: string) {
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt(),
    // Haiku 4.5 predates adaptive thinking and rejects `effort`.
    ...(IS_HAIKU
      ? { thinking: { type: "enabled" as const, budget_tokens: 2000 } }
      : { thinking: { type: "adaptive" as const } }),
    output_config: {
      ...(IS_HAIKU ? {} : { effort: "medium" as const }),
      format: zodOutputFormat(Result),
    },
    messages: [{ role: "user", content: userText }],
  });
  return res.parsed_output?.tasks ?? [];
}

export async function POST(req: Request) {
  const { text, defaultClient } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "no text" }, { status: 400 });

  const msgs = parseWhatsApp(text);
  let batches: string[];
  let kind: string;
  let truncated = false;

  if (msgs) {
    kind = "whatsapp";
    const all = chunk(msgs);
    truncated = all.length > MAX_CHUNKS;
    batches = all
      .slice(0, MAX_CHUNKS)
      .map((c) => c.map((m) => `[${m.when ?? "?"}] ${m.sender}: ${m.text}`).join("\n"));
  } else {
    kind = /^(from|to|subject|sent):/im.test(text) ? "email" : "note";
    batches = [text];
  }

  try {
    const results = await Promise.all(batches.map(extract));
    const tasks = results.flat().map((t) => ({
      ...t,
      client: t.client || defaultClient?.trim() || null,
      source_kind: kind,
    }));
    return NextResponse.json({ tasks, kind, truncated });
  } catch (e: any) {
    console.error("parse failed", e);
    return NextResponse.json({ error: e?.message ?? "parse failed" }, { status: 502 });
  }
}
