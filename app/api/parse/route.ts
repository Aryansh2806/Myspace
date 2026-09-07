import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { parseWhatsApp, chunk } from "@/lib/whatsapp.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TZ = "Asia/Kolkata";
// ponytail: hard cap so one huge export can't quietly run up a bill.
const MAX_CHUNKS = 15;

const Result = z.object({
  tasks: z.array(
    z.object({
      title: z.string().describe("Imperative, one line. What Aryan has to do."),
      client: z.string().nullable().describe("Person or company who wants it, else null"),
      due_at: z.string().nullable().describe("ISO 8601 with offset, else null"),
      source: z.string().describe("The message text this came from, verbatim"),
    }),
  ),
});

const client = new Anthropic();

function systemPrompt() {
  const now = new Date().toLocaleString("en-IN", { timeZone: TZ, hour12: false });
  return `You extract action items from messages Aryan received from clients.
Right now it is ${now} in ${TZ}. Resolve every relative date against that, and emit
ISO 8601 with the +05:30 offset.

Rules:
- Only extract things Aryan must DO. Skip greetings, acknowledgements, gossip,
  status updates, and anything the other person is doing themselves.
- Resolve "by Friday", "EOD tomorrow", "next week", "month end", and Hinglish forms
  ("kal", "parso", "agle hafte", "15 tarikh", "iss weekend") into real timestamps.
  "kal" is ambiguous (yesterday/tomorrow) — in a request it means tomorrow.
- A date with no time means 18:00 local. No date at all means null. Never invent one.
- title is imperative and self-contained: "Send Rahul the logo source files",
  not "logo files".
- client is the person or company asking. Use the sender name when the message
  gives no better name.
- source is the verbatim message the task came from, so Aryan can check it.
- If nothing is actionable, return an empty tasks array. That is a normal answer.`;
}

async function extract(userText: string) {
  const res = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: systemPrompt(),
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(Result) },
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
      .map((c) => c.map((m) => `${m.sender}: ${m.text}`).join("\n"));
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
