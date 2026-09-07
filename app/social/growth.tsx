"use client";

import { useState } from "react";
import type { Client, Platform } from "@/lib/supabase";

type Idea = {
  title: string;
  what: string;
  why: string;
  effort: "quick" | "medium" | "ongoing";
  verify: boolean;
};

/**
 * Growth ideas are not stored. An idea you actually intend to act on becomes a
 * task on the board, which is where work already lives — that is what makes it
 * real, not a row in a table you never open again.
 */
export default function Growth({ client }: { client: Client }) {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [added, setAdded] = useState<Set<number>>(new Set());

  async function generate() {
    setBusy(true);
    setErr("");
    setAdded(new Set());
    try {
      const res = await fetch("/api/social/growth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: client.id, platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIdeas(data.ideas);
    } catch (e: any) {
      setErr(e?.message ?? "Could not get ideas.");
    } finally {
      setBusy(false);
    }
  }

  async function toBoard(idea: Idea, i: number) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: idea.title,
        client: client.name,
        source: `${idea.what}\n\nWhy: ${idea.why}`,
        source_kind: "note",
      }),
    });
    if (res.ok) setAdded(new Set([...added, i]));
    else setErr("Could not add that to the board.");
  }

  return (
    <>
      <div className="capture plan-form">
        <label className="post-field">
          <span>Grow {client.name} on</span>
          <div className="chips">
            {(["instagram", "linkedin"] as Platform[]).map((p) => (
              <button
                key={p}
                type="button"
                className="chip"
                aria-pressed={platform === p}
                onClick={() => setPlatform(p)}
              >
                {p === "instagram" ? "Instagram" : "LinkedIn"}
              </button>
            ))}
          </div>
        </label>
        <div className="bar">
          <button className="btn is-primary" disabled={busy} onClick={generate}>
            {busy ? "Thinking…" : ideas ? "Again" : "Get ideas"}
          </button>
        </div>
        {busy && (
          <p className="muted" role="status">
            Reading {client.name}&rsquo;s profile — a few seconds.
          </p>
        )}
        {err && <p className="err">{err}</p>}
      </div>

      {ideas && (
        <ul className="stream">
          {ideas.map((idea, i) => (
            <li className="swipe" key={i}>
              <div className="task idea">
                <div className="idea-head">
                  <h3 className="idea-title">{idea.title}</h3>
                  <span className={`pill is-static effort-${idea.effort}`}>{idea.effort}</span>
                </div>
                <p className="post-line">{idea.what}</p>
                <p className="post-line muted">{idea.why}</p>
                {idea.verify && (
                  <p className="post-line verify">
                    Leans on how the platform behaves right now — worth checking this still holds.
                  </p>
                )}
                <div className="bar" style={{ marginTop: 4 }}>
                  <button
                    className="pill"
                    disabled={added.has(i)}
                    onClick={() => toBoard(idea, i)}
                  >
                    {added.has(i) ? "On the board" : "Add to board"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
