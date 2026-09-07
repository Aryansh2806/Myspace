import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// scribe_v2 is current; override if ElevenLabs moves on.
const MODEL = process.env.ELEVENLABS_STT_MODEL ?? "scribe_v2";

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Voice is not set up — ELEVENLABS_API_KEY is missing." },
      { status: 501 },
    );
  }

  const inbound = await req.formData();
  const audio = inbound.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "No audio received." }, { status: 400 });
  }
  // A tap that records nothing produces a few bytes of container header.
  if (audio.size < 2000) {
    return NextResponse.json({ error: "That was too short to hear. Hold and speak." }, { status: 400 });
  }

  const form = new FormData();
  form.append("file", audio, audio.name || "speech.webm");
  form.append("model_id", MODEL);
  // language_code is deliberately NOT set. Auto-detection is what lets one
  // sentence move between Hindi and English; pinning a language forces the
  // model to transliterate the other half.
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");

  let res: Response;
  try {
    res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not reach ElevenLabs: ${e?.message}` }, { status: 502 });
  }

  const raw = await res.text();
  if (!res.ok) {
    // Surfaced verbatim: a wrong model id or an out-of-credit account is
    // otherwise indistinguishable from "voice is broken".
    console.error("elevenlabs stt", res.status, raw.slice(0, 500));
    return NextResponse.json(
      { error: `ElevenLabs ${res.status}: ${raw.slice(0, 300)}` },
      { status: 502 },
    );
  }

  try {
    const data = JSON.parse(raw);
    return NextResponse.json({
      text: (data.text ?? "").trim(),
      language: data.language_code ?? null,
      seconds: data.audio_duration_secs ?? null,
    });
  } catch {
    return NextResponse.json({ error: "ElevenLabs returned something unreadable." }, { status: 502 });
  }
}
