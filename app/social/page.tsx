"use client";

import { useEffect, useState } from "react";
import type { Client, Post } from "@/lib/supabase";
import Ring from "../ring";
import PostRow from "./postrow";
import { weeksOf, sortQueue } from "@/lib/calendar.mjs";

export default function Social() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const [c, p] = await Promise.all([
        fetch("/api/clients").then((r) => r.json()),
        fetch("/api/posts").then((r) => r.json()),
      ]);
      if (c?.error || p?.error) return setErr(c?.error ?? p?.error);
      setErr("");
      setClients(c);
      setPosts(p);
    } catch {
      setErr("Could not reach the server. Check your connection, then reload.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, fields: Partial<Post>) {
    const before = posts!;
    setPosts((ps) => ps!.map((p) => (p.id === id ? { ...p, ...fields } : p)));
    const res = await fetch("/api/posts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
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

  if (err && !clients)
    return (
      <div className="empty">
        <p className="err">{err}</p>
        <button className="btn" onClick={load}>
          Try again
        </button>
      </div>
    );
  if (!clients || !posts) return <p className="muted">Loading…</p>;

  if (!clients.length)
    return (
      <div className="empty">
        <p>No brands yet. Describe one out loud and I'll build its profile.</p>
        <a className="btn is-primary" href="/social/new">
          Add a brand
        </a>
      </div>
    );

  const byId = new Map(clients.map((c) => [c.id, c]));
  const posted = posts.filter((p) => p.status === "posted").length;
  const upcoming = sortQueue(posts.filter((p) => p.status !== "posted")).slice(0, 12);
  const { weeks } = weeksOf(posts.filter((p) => p.status !== "posted"));
  const thisWeek = weeks[0]?.days.flatMap((d) => d.posts).length ?? 0;

  // The personal brand pins first; everything else alphabetical.
  const rail = [...clients].sort((a, b) =>
    a.is_self ? -1 : b.is_self ? 1 : a.name.localeCompare(b.name),
  );

  return (
    <div className="layout">
      <div className="side">
        <div className="hero">
          <Ring done={posted} total={posts.length} />
          <div>
            <h2 className="heroline">
              {posts.length === 0
                ? "No posts queued yet."
                : `${posts.length - posted} to post. ${posted} done.`}
            </h2>
            <div className="herofacts">
              {thisWeek > 0 && (
                <span className="fact is-warn">
                  <b>{thisWeek}</b> this week
                </span>
              )}
              <span className="fact">
                <b>{clients.length}</b> brands
              </span>
            </div>
          </div>
        </div>

        <h2 className="railhead">
          Brands <span className="n">{clients.length}</span>
        </h2>
        <div className="rail">
          {rail.map((c) => {
            const mine = posts.filter((p) => p.client_id === c.id);
            const done = mine.filter((p) => p.status === "posted").length;
            return (
              <a key={c.id} className="client" href={`/social/${c.id}`}>
                <span className="cname">
                  {c.name}
                  {c.is_self && <span className="pill is-static self-pill">You</span>}
                </span>
                <span className="minibar">
                  <i style={{ width: `${mine.length ? (done / mine.length) * 100 : 0}%` }} />
                </span>
                <span className="cmeta">
                  {done}/{mine.length} posted
                </span>
              </a>
            );
          })}
        </div>
        <div className="bar">
          <a className="btn" href="/social/new">
            + Brand
          </a>
        </div>
      </div>

      <div>
        <h2 className="railhead">
          Up next <span className="n">{upcoming.length}</span>
        </h2>
        {err && <p className="err">{err}</p>}
        {upcoming.length === 0 ? (
          <div className="empty">
            <p>Nothing queued. Open a brand and generate a plan.</p>
          </div>
        ) : (
          <ul className="stream">
            {upcoming.map((p) => (
              <PostRow
                key={p.id}
                p={p}
                patch={patch}
                remove={remove}
                showClient={byId.get(p.client_id)?.name ?? null}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
