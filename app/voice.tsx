"use client";

import { useEffect, useRef, useState } from "react";
import { levelFromWaveform } from "@/lib/audio.mjs";

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
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const shell = useRef<HTMLDivElement>(null);

  /** Always release the mic. A live track leaves the recording dot on. */
  function release() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    shell.current?.style.setProperty("--level", "0");
  }

  /**
   * Drive the halo from the actual input level. The one question a recorder
   * has to answer is "is it hearing me", and a level meter answers it in a way
   * a spinning icon never can.
   */
  function meter(src: MediaStream) {
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audioCtx.current = ctx;
    const node = ctx.createMediaStreamSource(src);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    node.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      const level = levelFromWaveform(buf);
      shell.current?.style.setProperty("--level", level.toFixed(3));
      raf.current = requestAnimationFrame(tick);
    };
    tick();
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
    meter(stream.current);
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
  const caption =
    state === "recording" ? "Listening — tap to stop"
    : state === "working" ? "Transcribing…"
    : idleLabel;

  return (
    <div className={`voice is-${state}`} ref={shell}>
      <button
        type="button"
        className="mic"
        onClick={state === "recording" ? stop : state === "idle" ? start : undefined}
        disabled={state === "working"}
        aria-label={state === "recording" ? `Stop recording, ${mmss}` : "Record a task"}
      >
        <span className="halo" aria-hidden="true" />
        <span className="face">
          {state === "recording" ? (
            <span className="square" aria-hidden="true" />
          ) : state === "working" ? (
            <span className="spin" aria-hidden="true" />
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
            </svg>
          )}
        </span>
      </button>
      <p className="voice-cap" role="status">
        {caption}
        {state === "recording" && <span className="clock"> {mmss}</span>}
      </p>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
