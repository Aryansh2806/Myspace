"use client";

import { useEffect, useRef, useState } from "react";

/** Safari records mp4; Chrome and Firefox record webm. Ask, don't assume. */
const CANDIDATES = [
  ["audio/webm;codecs=opus", "webm"],
  ["audio/webm", "webm"],
  ["audio/mp4", "mp4"],
  ["audio/aac", "aac"],
  ["audio/ogg;codecs=opus", "ogg"],
] as const;

function pickFormat() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const [mime, ext] of CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return { mime: "", ext: "webm" }; // let the browser choose
}

const MAX_SECONDS = 120;

export default function VoiceButton({
  onText,
  idleLabel = "Speak",
}: {
  onText: (text: string, meta: { language: string | null; seconds: number | null }) => void;
  idleLabel?: string;
}) {
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Always release the mic. A live track leaves the recording dot on. */
  function release() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }
  useEffect(() => release, []);

  async function start() {
    setErr("");
    const fmt = pickFormat();
    if (!fmt || !navigator.mediaDevices?.getUserMedia) {
      setErr("This browser cannot record audio.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e: any) {
      setErr(
        e?.name === "NotAllowedError"
          ? "Microphone blocked. Allow it in your browser settings and try again."
          : `Could not open the microphone: ${e?.message ?? e?.name}`,
      );
      return;
    }

    chunks.current = [];
    const mr = new MediaRecorder(stream.current, fmt.mime ? { mimeType: fmt.mime } : undefined);
    rec.current = mr;
    mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    mr.onstop = () => {
      const type = mr.mimeType || fmt.mime || "audio/webm";
      const blob = new Blob(chunks.current, { type });
      release();
      void send(blob, fmt.ext);
    };
    mr.start();
    setState("recording");
    setSecs(0);
    timer.current = setInterval(() => {
      setSecs((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
    setState("working");
  }

  async function send(blob: Blob, ext: string) {
    if (blob.size < 2000) {
      setErr("That was too short to hear. Hold the button and speak.");
      setState("idle");
      return;
    }
    const body = new FormData();
    body.append("audio", blob, `speech.${ext}`);
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed");
      if (!data.text) throw new Error("Nothing was said, or it was too quiet to hear.");
      onText(data.text, { language: data.language ?? null, seconds: data.seconds ?? null });
    } catch (e: any) {
      setErr(e?.message ?? "Transcription failed");
    } finally {
      setState("idle");
    }
  }

  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <>
      <button
        type="button"
        className={`btn mic${state === "recording" ? " is-live" : ""}`}
        onClick={state === "recording" ? stop : state === "idle" ? start : undefined}
        disabled={state === "working"}
        aria-live="polite"
      >
        {state === "recording" ? (
          <>
            <span className="pulse" aria-hidden="true" />
            Stop · <span className="clock">{mmss}</span>
          </>
        ) : state === "working" ? (
          "Transcribing…"
        ) : (
          <>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
            </svg>
            {idleLabel}
          </>
        )}
      </button>
      {err && <p className="err">{err}</p>}
    </>
  );
}
