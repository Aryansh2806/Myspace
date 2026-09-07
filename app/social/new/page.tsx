"use client";

import { useState } from "react";
import VoiceButton from "../../voice";
import type { Language } from "@/lib/supabase";

type Profile = {
  name: string;
  voice: string;
  audience: string;
  pillars: string[];
  tone_do: string[];
  tone_dont: string[];
  colours: string[];
  links: { instagram: string | null; linkedin: string | null; website: string | null };
  language: Language;
  notes: string;
};

/** Comma-or-newline separated, so a list can be edited as plain text. */
const toList = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export default function NewBrand() {
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [isSelf, setIsSelf] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  async function build() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/social/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data.profile);
    } catch (e: any) {
      setErr(e?.message ?? "Could not read that brief.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...profile, is_self: isSelf }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = `/social/${data[0].id}`;
    } catch (e: any) {
      setErr(e?.message ?? "Could not save.");
      setBusy(false);
    }
  }

  const set = (k: keyof Profile, v: unknown) => setProfile({ ...profile!, [k]: v } as Profile);

  if (profile) {
    return (
      <>
        <h2 className="railhead">Check the profile</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          This is what every caption will be written from. The specifics matter most — a thin
          profile produces generic posts.
        </p>

        <div className="profile-form">
          <label className="post-field">
            <span>Name</span>
            <input className="field" value={profile.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="post-field">
            <span>Voice</span>
            <textarea className="field caption-field" value={profile.voice} onChange={(e) => set("voice", e.target.value)} />
          </label>
          <label className="post-field">
            <span>Audience</span>
            <textarea className="field" value={profile.audience} onChange={(e) => set("audience", e.target.value)} />
          </label>
          <label className="post-field">
            <span>Content pillars — one per line</span>
            <textarea className="field" value={profile.pillars.join("\n")} onChange={(e) => set("pillars", toList(e.target.value))} />
          </label>
          <label className="post-field">
            <span>Always</span>
            <textarea className="field" value={profile.tone_do.join("\n")} onChange={(e) => set("tone_do", toList(e.target.value))} />
          </label>
          <label className="post-field">
            <span>Never</span>
            <textarea className="field" value={profile.tone_dont.join("\n")} onChange={(e) => set("tone_dont", toList(e.target.value))} />
          </label>
          <label className="post-field">
            <span>Specific facts — names, products, the things they always say</span>
            <textarea
              className="field caption-field"
              value={profile.notes}
              placeholder="The single most valuable field. An empty one guarantees generic captions."
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
          <label className="post-field">
            <span>Posts should be written in</span>
            <div className="chips">
              {(["english", "hinglish", "hindi"] as Language[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  className="chip"
                  aria-pressed={profile.language === l}
                  onClick={() => set("language", l)}
                >
                  {l[0].toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
          </label>
        </div>

        {err && <p className="err">{err}</p>}
        <div className="bar">
          <button className="btn is-primary" disabled={busy || !profile.name.trim()} onClick={save}>
            {busy ? "Saving…" : "Save brand"}
          </button>
          <button className="btn" onClick={() => setProfile(null)}>
            Back
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="railhead">Tell me about the brand</h2>

      <div className="capture">
        <VoiceButton
          idleLabel="Tap and describe this brand"
          onText={(t, meta) => {
            setText((prev) => (prev ? prev + "\n" + t : t));
            setNote(
              `Heard ${meta.seconds ? Math.round(meta.seconds) + "s" : "you"}` +
                (meta.language ? ` · ${meta.language}` : "") +
                ". Add more, or build the profile.",
            );
          }}
        />
      </div>

      <p className="or">
        <span>or type it</span>
      </p>

      <textarea
        className="field paste-field"
        placeholder="Who are they, what do they sell, who buys it, how should they sound, what do they never want to say? Names and specifics help most."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="bar">
        <button className="btn is-primary" disabled={busy || !text.trim()} onClick={build}>
          {busy ? "Reading…" : "Build profile"}
        </button>
        <label className="toggle">
          <input type="checkbox" checked={isSelf} onChange={(e) => setIsSelf(e.target.checked)} /> This
          is me
        </label>
      </div>
      <div className="bar" style={{ marginTop: 8 }}>
        <input
          className="field"
          placeholder="Brand name (optional — I'll infer it)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {note && !busy && (
        <p className="muted" role="status">
          {note}
        </p>
      )}
      {err && <p className="err">{err}</p>}
    </>
  );
}
