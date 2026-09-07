"use client";

import { useState } from "react";

type Draft = {
  title: string;
  client: string | null;
  due_at: string | null;
  source: string;
  source_kind: string;
  keep: boolean;
};

const toInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function Inbox() {
  const [text, setText] = useState("");
  const [client, setClient] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  async function parse() {
    setBusy(true);
    setErr("");
    setNote("");
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, defaultClient: client }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDrafts(data.tasks.map((t: Draft) => ({ ...t, keep: true })));
      setNote(
        `Read as ${data.kind}. Found ${data.tasks.length}.` +
          (data.truncated ? " Export was long — only the first part was read." : ""),
      );
    } catch (e: any) {
      setErr(e.message ?? "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const keep = drafts!.filter((d) => d.keep);
    setBusy(true);
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(keep),
    });
    window.location.href = "/";
  }

  if (drafts) {
    return (
      <>
        <h2>Review — {drafts.filter((d) => d.keep).length} of {drafts.length} selected</h2>
        <p className="muted">{note} Nothing is saved until you hit Save.</p>
        <div className="card">
          {drafts.map((d, i) => (
            <div className="row" key={i}>
              <input
                type="checkbox"
                checked={d.keep}
                onChange={(e) =>
                  setDrafts(drafts.map((x, j) => (i === j ? { ...x, keep: e.target.checked } : x)))
                }
              />
              <input
                type="text"
                value={d.title}
                title={d.source}
                onChange={(e) =>
                  setDrafts(drafts.map((x, j) => (i === j ? { ...x, title: e.target.value } : x)))
                }
              />
              <input
                type="text"
                style={{ maxWidth: 120 }}
                placeholder="client"
                value={d.client ?? ""}
                onChange={(e) =>
                  setDrafts(drafts.map((x, j) => (i === j ? { ...x, client: e.target.value } : x)))
                }
              />
              <input
                type="datetime-local"
                value={toInput(d.due_at)}
                onChange={(e) =>
                  setDrafts(
                    drafts.map((x, j) =>
                      i === j
                        ? { ...x, due_at: e.target.value ? new Date(e.target.value).toISOString() : null }
                        : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          {drafts.length === 0 && <p className="muted" style={{ padding: 12 }}>Nothing actionable found.</p>}
        </div>
        <div className="bar">
          <button className="primary" disabled={busy || !drafts.some((d) => d.keep)} onClick={save}>
            Save {drafts.filter((d) => d.keep).length}
          </button>
          <button className="ghost" onClick={() => setDrafts(null)}>
            Back
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2>Paste anything</h2>
      <textarea
        placeholder="A WhatsApp message, an email, a note to self — or drop a WhatsApp _chat.txt export here."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onDrop={async (e) => {
          const f = e.dataTransfer.files[0];
          if (!f) return;
          e.preventDefault();
          setText(await f.text());
        }}
      />
      <div className="bar">
        <button className="primary" disabled={busy || !text.trim()} onClick={parse}>
          {busy ? "Reading…" : "Find tasks"}
        </button>
        <input
          type="text"
          placeholder="default client (optional)"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          style={{ padding: 8, border: "1px solid #ddd", borderRadius: 8, font: "inherit" }}
        />
        <label className="ghost" style={{ cursor: "pointer" }}>
          Upload _chat.txt
          <input
            type="file"
            accept=".txt"
            hidden
            onChange={async (e) => e.target.files?.[0] && setText(await e.target.files[0].text())}
          />
        </label>
        {err && <span className="err">{err}</span>}
      </div>
    </>
  );
}
