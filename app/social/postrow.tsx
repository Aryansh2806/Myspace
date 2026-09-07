"use client";

import { useState } from "react";
import type { Post } from "@/lib/supabase";

/** Same wording the board uses, so a date reads the same in both modules. */
export function humanWhen(iso: string) {
  const d = new Date(iso);
  const days = Math.round(
    (new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  if (days < -1) return `${-days} days ago`;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return days < 7 ? `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${date}` : date;
}

function state(p: Post) {
  if (p.status === "posted" || !p.scheduled_at) return "";
  const d = new Date(p.scheduled_at);
  if (d < new Date()) return "overdue";
  return d.toDateString() === new Date().toDateString() ? "today" : "";
}

/** Caption plus hashtags, which is what actually goes in the app. */
export function fullCaption(p: Post) {
  const tags = (p.hashtags ?? []).map((h) => `#${h}`).join(" ");
  return [p.caption, tags].filter(Boolean).join("\n\n");
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="pill"
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/**
 * Reuses the board's .swipe/.task row wholesale. The check marks POSTED, and
 * Copy is the most reachable control because in a drafts-only product that
 * button is the entire delivery mechanism.
 */
export default function PostRow({
  p,
  patch,
  remove,
  showClient,
}: {
  p: Post;
  patch: (id: string, fields: Partial<Post>) => void;
  remove: (p: Post) => void;
  showClient?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const posted = p.status === "posted";
  const s = state(p);

  return (
    <li className="swipe">
      <div className={`task${posted ? " is-done" : ""}`}>
        <input
          className="task-check"
          type="checkbox"
          checked={posted}
          aria-label={`Mark "${p.hook ?? "post"}" posted`}
          onChange={(e) => patch(p.id, { status: e.target.checked ? "posted" : "draft" })}
        />

        <textarea
          className="task-title"
          rows={1}
          defaultValue={p.hook ?? ""}
          placeholder="Hook — the first line"
          aria-label="Hook"
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          onBlur={(e) => e.target.value !== (p.hook ?? "") && patch(p.id, { hook: e.target.value })}
        />

        <div className="task-meta">
          {showClient && <span className="pill is-static client-pill">{showClient}</span>}
          <span className="pill is-static">{p.platform === "instagram" ? "Instagram" : "LinkedIn"}</span>
          <span className="pill is-static">{p.format}</span>
          {p.scheduled_at ? (
            <span className={`pill is-static${s === "overdue" ? " is-overdue" : s === "today" ? " is-today" : ""}`}>
              {s === "overdue" ? "Late · " : ""}
              {humanWhen(p.scheduled_at)}
            </span>
          ) : (
            <span className="pill is-ghost is-static">No date</span>
          )}
          <Copy text={fullCaption(p)} label="Copy" />
          <button className="pill" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Open"}
          </button>
        </div>

        <button className="task-del" aria-label="Delete post" onClick={() => remove(p)}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && (
          <div className="task-source">
            {p.pillar && (
              <p className="post-line">
                <strong>Pillar:</strong> {p.pillar}
              </p>
            )}
            <label className="post-field">
              <span>Caption</span>
              <textarea
                className="field caption-field"
                defaultValue={p.caption ?? ""}
                onBlur={(e) =>
                  e.target.value !== (p.caption ?? "") && patch(p.id, { caption: e.target.value })
                }
              />
            </label>
            {(p.hashtags?.length ?? 0) > 0 && (
              <p className="post-line">{p.hashtags!.map((h) => `#${h}`).join(" ")}</p>
            )}
            {p.image_prompt && (
              <p className="post-line">
                <strong>Image prompt:</strong> {p.image_prompt}
              </p>
            )}
            {p.cta && (
              <p className="post-line">
                <strong>CTA:</strong> {p.cta}
              </p>
            )}
            <div className="bar" style={{ marginTop: 10 }}>
              <Copy text={p.caption ?? ""} label="Copy caption" />
              <Copy text={(p.hashtags ?? []).map((h) => `#${h}`).join(" ")} label="Copy hashtags" />
              <Copy text={p.image_prompt ?? ""} label="Copy image prompt" />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
