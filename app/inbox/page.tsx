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
        <h2 className="railhead">
          Review <span className="n">{drafts.filter((d) => d.keep).length} of {drafts.length} selected</span>
        </h2>
        <p className="muted" style={{ marginTop: 0 }}>{note} Nothing is saved until you hit Save.</p>
        <ul className="stream">
          {drafts.map((d, i) => (
            <li className="task" key={i}>
              <input
                className="task-check"
                type="checkbox"
                checked={d.keep}
                aria-label={`Keep “${d.title}”`}
                onChange={(e) =>
                  setDrafts(drafts.map((x, j) => (i === j ? { ...x, keep: e.target.checked } : x)))
                }
              />
              <input
                className="task-title"
                type="text"
                value={d.title}
                aria-label="Task"
                onChange={(e) =>
                  setDrafts(drafts.map((x, j) => (i === j ? { ...x, title: e.target.value } : x)))
                }
              />
              <div className="task-meta">
                <label className="pill is-static">
                  <input
                    type="text"
                    size={10}
                    placeholder="client"
                    aria-label="Client"
                    style={{ border: 0, background: "none", padding: 0, fontSize: "12.5px", minWidth: 0 }}
                    value={d.client ?? ""}
                    onChange={(e) =>
                      setDrafts(drafts.map((x, j) => (i === j ? { ...x, client: e.target.value } : x)))
                    }
                  />
                </label>
                <label className="pill is-static">
                  <input
                    type="datetime-local"
                    aria-label="Due date"
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
                </label>
              </div>
              {d.source && <div className="task-source">{d.source}</div>}
            </li>
          ))}
        </ul>
        {drafts.length === 0 && (
          <div className="empty">
            <p>Nothing actionable found in that text.</p>
          </div>
        )}
        <div className="bar">
          <button className="btn is-primary" disabled={busy || !drafts.some((d) => d.keep)} onClick={save}>
            Save {drafts.filter((d) => d.keep).length}
          </button>
          <button className="btn" onClick={() => setDrafts(null)}>
            Back
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="railhead">Paste anything</h2>
      <textarea
        className="field"
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
        <button className="btn is-primary" disabled={busy || !text.trim()} onClick={parse}>
          {busy ? "Reading…" : "Find tasks"}
        </button>
        <label className="btn" style={{ cursor: "pointer" }}>
          Upload chat
          <input
            type="file"
            accept=".txt"
            hidden
            onChange={async (e) => e.target.files?.[0] && setText(await e.target.files[0].text())}
          />
        </label>
      </div>
      <div className="bar" style={{ marginTop: 8 }}>
        <input
          className="field"
          type="text"
          placeholder="Default client for these tasks (optional)"
          aria-label="Default client"
          value={client}
          onChange={(e) => setClient(e.target.value)}
        />
      </div>
      {err && <p className="err">{err}</p>}
      {busy && <p className="muted" role="status">Reading the text and pulling out tasks — this takes a few seconds.</p>}
    </>
  );
}
