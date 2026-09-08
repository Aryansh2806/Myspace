"use client";

import { useState } from "react";
import type { Client, Platform, Market } from "@/lib/supabase";

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
export function MarketPanel({ client }: { client: Client }) {
  const [market, setMarket] = useState<Market | null>(client.market);
  const [seen, setSeen] = useState(client.competitor_notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function analyse() {
    setBusy(true);
    setErr("");
    try {
      // Save what the user has seen first — it is the highest-signal input.
      if (seen.trim() !== (client.competitor_notes ?? "")) {
        await fetch("/api/clients", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: client.id, competitor_notes: seen }),
        });
      }
      const res = await fetch("/api/social/market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: client.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMarket(data.market);
    } catch (e: any) {
      setErr(e?.message ?? "Could not map the market.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="capture plan-form">
        <label className="post-field">
          <span>Competitors you have actually seen (optional, but the best input)</span>
          <textarea
            className="field"
            placeholder="Handles, what they post, what annoys you about it. Anything you have noticed beats anything I can guess."
            value={seen}
            onChange={(e) => setSeen(e.target.value)}
          />
        </label>
        <div className="bar">
          <button className="btn is-primary" disabled={busy} onClick={analyse}>
            {busy ? "Mapping…" : market ? "Redo analysis" : "Map the market"}
          </button>
        </div>
        <p className="muted">
          From category knowledge, not live search — I tested that and it took six minutes and
          still would not quote sources it could not verify.
        </p>
        {err && <p className="err">{err}</p>}
      </div>

      {market && (
        <>
          <h2 className="railhead">
            {market.category} <span className="n">confidence: {market.confidence}</span>
          </h2>
          <ul className="stream">
            {market.competitors.map((c, i) => (
              <li className="swipe" key={i}>
                <div className="task idea">
                  <div className="idea-head">
                    <h3 className="idea-title">{c.name}</h3>
                    <span className="pill is-static">leads on {c.positions_on}</span>
                  </div>
                  <p className="post-line muted">Weak at: {c.weakness}</p>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="railhead">What you could own</h2>
          <ul className="stream">
            {market.openings.map((o, i) => (
              <li className="swipe" key={i}>
                <div className="task idea">
                  <h3 className="idea-title">{o.opening}</h3>
                  <p className="post-line muted">{o.why_now}</p>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="railhead">
            Banned in every plan <span className="n">{market.cliches.length}</span>
          </h2>
          <div className="task idea">
            <p className="post-line muted">
              Everyone in this category already says these, so the planner is told never to.
            </p>
            <div className="chips">
              {market.cliches.map((c) => (
                <span className="chip banned" key={c}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

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
