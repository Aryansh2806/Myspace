"use client";

import { use, useEffect, useState } from "react";
import type { Client, Post, Platform } from "@/lib/supabase";
import PostRow from "../postrow";
import Growth from "../growth";
import { weeksOf, sortQueue } from "@/lib/calendar.mjs";

type Draft = Post & { why?: string; keep: boolean };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default function Brand({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState("");

  // plan generation
  const [planning, setPlanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(8);
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram"]);
  const [start, setStart] = useState(ymd(new Date()));
  const [end, setEnd] = useState(ymd(new Date(Date.now() + 13 * 864e5)));
  const [brief, setBrief] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [growing, setGrowing] = useState(false);

  async function load() {
    try {
      const [c, p] = await Promise.all([
        fetch("/api/clients").then((r) => r.json()),
        fetch(`/api/posts?client_id=${id}`).then((r) => r.json()),
      ]);
      if (c?.error || p?.error) return setErr(c?.error ?? p?.error);
      const found = (c as Client[]).find((x) => x.id === id) ?? null;
      if (!found) return setErr("That brand no longer exists.");
      setErr("");
      setClient(found);
      setPosts(p);
    } catch {
      setErr("Could not reach the server. Check your connection, then reload.");
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  async function patch(postId: string, fields: Partial<Post>) {
    const before = posts!;
    setPosts((ps) => ps!.map((p) => (p.id === postId ? { ...p, ...fields } : p)));
    const res = await fetch("/api/posts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: postId, ...fields }),
    });
    if (!res.ok) {
      setPosts(before);
      setErr("That change did not save.");
    }
  }

  async function remove(p: Post) {
    setPosts((ps) => ps!.filter((x) => x.id !== p.id));
    await fetch(`/api/posts?id=${p.id}`, { method: "DELETE" });
  }

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/social/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: id, count, start, end, platforms, brief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts(data.posts.map((p: Draft) => ({ ...p, keep: true })));
    } catch (e: any) {
      setErr(e?.message ?? "Could not write a plan.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDrafts() {
    const keep = drafts!.filter((d) => d.keep);
    setBusy(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          keep.map(({ keep: _k, why: _w, ...p }) => ({ ...p, client_id: id, status: "draft" })),
        ),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setDrafts(null);
      setPlanning(false);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  if (err && !client)
    return (
      <div className="empty">
        <p className="err">{err}</p>
        <a className="btn" href="/social">
          Back to brands
        </a>
      </div>
    );
  if (!client || !posts) return <p className="muted">Loading…</p>;

  // --- review screen: nothing reaches the database unreviewed ---
  if (drafts) {
    const kept = drafts.filter((d) => d.keep).length;
    return (
      <>
        <h2 className="railhead">
          Review <span className="n">{kept} of {drafts.length} kept</span>
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Read the “why” line on each. Uncheck anything that would fit any other brand.
        </p>
        <ul className="stream">
          {drafts.map((d, i) => (
            <li className="swipe" key={i}>
              <div className="task">
                <input
                  className="task-check"
                  type="checkbox"
                  checked={d.keep}
                  aria-label={`Keep "${d.hook}"`}
                  onChange={(e) =>
                    setDrafts(drafts.map((x, j) => (i === j ? { ...x, keep: e.target.checked } : x)))
                  }
                />
                <textarea
                  className="task-title"
                  rows={2}
                  value={d.hook ?? ""}
                  aria-label="Hook"
                  onChange={(e) =>
                    setDrafts(drafts.map((x, j) => (i === j ? { ...x, hook: e.target.value } : x)))
                  }
                />
                <div className="task-meta">
                  <span className="pill is-static">{d.platform}</span>
                  <span className="pill is-static">{d.format}</span>
                  {d.pillar && <span className="pill is-static client-pill">{d.pillar}</span>}
                  <span className="pill is-static">
                    {d.scheduled_at
                      ? new Date(d.scheduled_at).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })
                      : "No date"}
                  </span>
                </div>
                <div className="task-source">
                  {d.why && (
                    <p className="post-line">
                      <strong>Why:</strong> {d.why}
                    </p>
                  )}
                  <label className="post-field">
                    <span>Caption</span>
                    <textarea
                      className="field caption-field"
                      value={d.caption ?? ""}
                      onChange={(e) =>
                        setDrafts(drafts.map((x, j) => (i === j ? { ...x, caption: e.target.value } : x)))
                      }
                    />
                  </label>
                  {(d.hashtags?.length ?? 0) > 0 && (
                    <p className="post-line">{d.hashtags!.map((h) => `#${h}`).join(" ")}</p>
                  )}
                  {d.image_prompt && (
                    <p className="post-line">
                      <strong>Image prompt:</strong> {d.image_prompt}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {err && <p className="err">{err}</p>}
        <div className="bar">
          <button className="btn is-primary" disabled={busy || !kept} onClick={saveDrafts}>
            {busy ? "Saving…" : `Save ${kept}`}
          </button>
          <button className="btn" onClick={() => setDrafts(null)}>
            Discard
          </button>
        </div>
      </>
    );
  }

  const posted = posts.filter((p) => p.status === "posted").length;
  const { weeks, unscheduled } = weeksOf(posts);

  return (
    <>
      <div className="hero brand-hero">
        <div>
          <h2 className="heroline">
            {client.name}
            {client.is_self && <span className="pill is-static self-pill">You</span>}
          </h2>
          {client.voice && <p className="muted">{client.voice}</p>}
          <div className="chips" style={{ marginTop: 10 }}>
            {(client.pillars ?? []).map((p) => (
              <span key={p} className="chip" aria-pressed="false">
                {p}
              </span>
            ))}
          </div>
          <div className="herofacts" style={{ marginTop: 10 }}>
            <span className="fact">
              <b>{posts.length - posted}</b> queued
            </span>
            <span className="fact">
              <b>{posted}</b> posted
            </span>
            <span className="fact">{client.language}</span>
          </div>
        </div>
      </div>

      {!planning && !growing ? (
        <div className="bar">
          <button className="btn is-primary" onClick={() => setPlanning(true)}>
            Generate plan
          </button>
          <button className="btn" onClick={() => setGrowing(true)}>
            Growth ideas
          </button>
          <a className="btn" href="/social">
            All brands
          </a>
        </div>
      ) : growing ? (
        <>
          <div className="bar">
            <button className="btn" onClick={() => setGrowing(false)}>
              Back to posts
            </button>
          </div>
          <Growth client={client} />
        </>
      ) : (
        <div className="capture plan-form">
          <label className="post-field">
            <span>How many posts</span>
            <div className="chips">
              {[4, 8, 12, 16].map((n) => (
                <button key={n} type="button" className="chip" aria-pressed={count === n} onClick={() => setCount(n)}>
                  {n}
                </button>
              ))}
            </div>
          </label>
          <label className="post-field">
            <span>Where</span>
            <div className="chips">
              {(["instagram", "linkedin"] as Platform[]).map((pl) => (
                <button
                  key={pl}
                  type="button"
                  className="chip"
                  aria-pressed={platforms.includes(pl)}
                  onClick={() =>
                    setPlatforms((cur) =>
                      cur.includes(pl) ? cur.filter((x) => x !== pl) || [] : [...cur, pl],
                    )
                  }
                >
                  {pl === "instagram" ? "Instagram" : "LinkedIn"}
                </button>
              ))}
            </div>
          </label>
          <div className="bar" style={{ marginTop: 0 }}>
            <label className="post-field" style={{ flex: 1 }}>
              <span>From</span>
              <input className="field" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="post-field" style={{ flex: 1 }}>
              <span>To</span>
              <input className="field" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="post-field">
            <span>Anything specific this batch? (optional)</span>
            <input
              className="field"
              placeholder="e.g. push the Diwali offer, or the new site launch"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </label>
          <div className="bar">
            <button className="btn is-primary" disabled={busy || !platforms.length} onClick={generate}>
              {busy ? "Writing…" : `Write ${count} posts`}
            </button>
            <button className="btn" onClick={() => setPlanning(false)}>
              Cancel
            </button>
          </div>
          {busy && (
            <p className="muted" role="status">
              Writing {count} posts from {client.name}&rsquo;s profile — this takes a few seconds.
            </p>
          )}
        </div>
      )}

      {err && <p className="err">{err}</p>}

      {posts.length === 0 ? (
        <div className="empty">
          <p>No posts yet for {client.name}.</p>
        </div>
      ) : (
        <>
          {weeks.map((w) => (
            <div key={w.weekStart}>
              <h2 className="railhead">
                Week of{" "}
                {new Date(`${w.weekStart}T12:00:00Z`).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
                <span className="n">{w.days.reduce((a, d) => a + d.posts.length, 0)}</span>
              </h2>
              <ul className="stream">
                {w.days.flatMap((d) => d.posts).map((p) => (
                  <PostRow key={p.id} p={p} patch={patch} remove={remove} />
                ))}
              </ul>
            </div>
          ))}
          {unscheduled.length > 0 && (
            <>
              <h2 className="railhead">
                No date <span className="n">{unscheduled.length}</span>
              </h2>
              <ul className="stream">
                {sortQueue(unscheduled).map((p) => (
                  <PostRow key={p.id} p={p} patch={patch} remove={remove} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
