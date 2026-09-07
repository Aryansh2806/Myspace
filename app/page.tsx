"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/supabase";
import { selectDue, endOfDay, sortTasks, nextPriority } from "@/lib/due.mjs";
import type { Priority } from "@/lib/supabase";

const NOTIFY_AHEAD_MS = 2 * 60 * 60 * 1000;

const toInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Never a bare numeric date — "06/09" is unreadable at a glance and ambiguous. */
function humanDue(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round(
    (new Date(d).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / 86400000,
  );
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true });
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  if (days < -1) return `${-days} days ago`;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return days < 7 ? `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${date}` : date;
}

/** Grow a one-line textarea to fit its wrapped content. */
function grow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

type State = "overdue" | "today" | "later" | "undated";
function stateOf(t: Task): State {
  if (!t.due_at) return "undated";
  const d = new Date(t.due_at);
  if (d < new Date()) return "overdue";
  return d.toDateString() === new Date().toDateString() ? "today" : "later";
}

export default function Board() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [err, setErr] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [filter, setFilter] = useState<"all" | "due">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [undo, setUndo] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("denied");
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    const res = await fetch("/api/tasks");
    const body = await res.json();
    if (!res.ok) return setErr(body.error ?? "Could not load tasks");
    setTasks(body);
  };

  useEffect(() => {
    load();
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  useEffect(() => {
    if (!tasks || perm !== "granted") return;
    const fire = () => {
      let seen: string[] = [];
      try {
        seen = JSON.parse(localStorage.getItem("notified") ?? "[]");
      } catch {}
      const set = new Set(seen);
      for (const t of selectDue(tasks, Date.now() + NOTIFY_AHEAD_MS)) {
        if (set.has(t.id)) continue;
        new Notification(t.client ? `${t.client} — due` : "Due", { body: t.title, tag: t.id });
        set.add(t.id);
      }
      const live = new Set(tasks.map((t) => t.id));
      localStorage.setItem("notified", JSON.stringify([...set].filter((id) => live.has(id))));
    };
    fire();
    const h = setInterval(fire, 5 * 60 * 1000);
    return () => clearInterval(h);
  }, [tasks, perm]);

  async function patch(id: string, fields: Partial<Task>) {
    const before = tasks!;
    setTasks((ts) => ts!.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    // Fire-and-forget hides failures; roll back so the screen can't lie.
    if (!res.ok) {
      setTasks(before);
      setErr("That change did not save. Check your connection.");
    }
  }

  /** Soft delete: the row is only hidden, so it can come back. */
  async function drop(t: Task) {
    setTasks((ts) => ts!.filter((x) => x.id !== t.id));
    setUndo(t);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, status: "dropped" }),
    });
  }

  async function undrop(t: Task) {
    setUndo(null);
    setTasks((ts) => [t, ...ts!]);
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, status: "open" }),
    });
    load();
  }

  async function add(draft: { title: string; client: string; due_at: string | null; priority: Priority }) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, source_kind: "note" }),
    });
    const body = await res.json();
    if (!res.ok) {
      setErr(body.error ?? "Could not add that task");
      return false;
    }
    setTasks((ts) => [...body, ...ts!]);
    return true;
  }

  if (err && !tasks) return <p className="err">{err}</p>;
  if (!tasks)
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );

  const live = tasks.filter((t) => t.status !== "done");
  const dueIds = new Set(selectDue(tasks, endOfDay()).map((t) => t.id));
  const counts = {
    open: live.length,
    overdue: live.filter((t) => stateOf(t) === "overdue").length,
    today: live.filter((t) => stateOf(t) === "today").length,
    undated: live.filter((t) => stateOf(t) === "undated").length,
  };

  const visible = tasks
    .filter((t) => showDone || t.status !== "done")
    .filter((t) => filter === "all" || dueIds.has(t.id));

  const groups = new Map<string, Task[]>();
  for (const t of visible) {
    const k = t.client?.trim() || "Unassigned";
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  // Clients with something due float to the top; Unassigned always sinks.
  const order = [...groups.keys()].sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    const urgent = (k: string) => (groups.get(k)!.some((t) => dueIds.has(t.id)) ? 0 : 1);
    return urgent(a) - urgent(b) || a.localeCompare(b);
  });

  return (
    <>
      <div className="stats">
        <div className="stat">
          <b>{counts.open}</b>
          <span>Open</span>
        </div>
        <div className={`stat${counts.overdue ? " is-danger" : ""}`}>
          <b>{counts.overdue}</b>
          <span>Overdue</span>
        </div>
        <div className={`stat${counts.today ? " is-warn" : ""}`}>
          <b>{counts.today}</b>
          <span>Today</span>
        </div>
        <div className="stat">
          <b>{counts.undated}</b>
          <span>No date</span>
        </div>
      </div>

      {err && <p className="err">{err}</p>}

      {visible.length === 0 ? (
        <div className="empty">
          <p>{filter === "due" ? "Nothing due today." : "No tasks yet."}</p>
          {filter === "all" && (
            <a className="btn is-primary" href="/inbox">
              Paste a message
            </a>
          )}
        </div>
      ) : (
        order.map((client) => (
          <section key={client}>
            <h2 className="group-head">
              {client} <span className="count">{groups.get(client)!.length}</span>
            </h2>
            <ul className="list">
              {sortTasks(groups.get(client)!).map((t) => (
                <Row
                  key={t.id}
                  t={t}
                  open={open === t.id}
                  toggle={() => setOpen(open === t.id ? null : t.id)}
                  patch={patch}
                  drop={drop}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="bar">
        <button className="btn is-primary" onClick={() => setAdding(true)}>
          + Task
        </button>
        <button
          className="toggle"
          aria-pressed={filter === "due"}
          onClick={() => setFilter(filter === "due" ? "all" : "due")}
        >
          <input type="checkbox" readOnly checked={filter === "due"} tabIndex={-1} aria-hidden="true" /> Due only
        </button>
        <button className="toggle" aria-pressed={showDone} onClick={() => setShowDone(!showDone)}>
          <input type="checkbox" readOnly checked={showDone} tabIndex={-1} aria-hidden="true" /> Done
        </button>
        {perm === "default" && (
          <button className="toggle" onClick={() => Notification.requestPermission().then(setPerm)}>
            Enable reminders
          </button>
        )}
      </div>

      <AddTask
        open={adding}
        close={() => setAdding(false)}
        add={add}
        clients={[...new Set(tasks.map((t) => t.client?.trim()).filter(Boolean))] as string[]}
      />

      {undo && (
        <div className="undo" role="status">
          <span>Removed “{undo.title || "Untitled"}”</span>
          <button onClick={() => undrop(undo)}>Undo</button>
        </div>
      )}
    </>
  );
}

/** A datetime-local value at 18:00 on that day — how the parser dates a bare day. */
function at18(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T18:00`;
}

const QUICK: [string, () => Date][] = [
  ["Today", () => new Date()],
  ["Tomorrow", () => new Date(Date.now() + 864e5)],
  ["Next week", () => new Date(Date.now() + 7 * 864e5)],
];

function AddTask({
  open,
  close,
  add,
  clients,
}: {
  open: boolean;
  close: () => void;
  add: (d: { title: string; client: string; due_at: string | null; priority: Priority }) => Promise<boolean>;
  clients: string[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [due, setDue] = useState("");
  const [pri, setPri] = useState<Priority>("normal");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  function reset() {
    setTitle("");
    setClient("");
    setDue("");
    setPri("normal");
  }

  /** Tapping the active chip again clears the date. */
  function quick(make: () => Date) {
    const v = at18(make());
    setDue(due === v ? "" : v);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const ok = await add({
      title: title.trim(),
      client: client.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      priority: pri,
    });
    setBusy(false);
    if (ok) {
      reset();
      close();
    }
  }

  return (
    <dialog className="sheet" ref={ref} onClose={close} aria-labelledby="add-title">
      <form onSubmit={submit}>
        <h2 id="add-title">New task</h2>

        <label>
          Task
          <textarea
            className="field"
            value={title}
            autoFocus
            placeholder="What needs doing?"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
            }}
          />
        </label>

        <label>
          Client
          {/* datalist: suggests the clients already on the board, still free text */}
          <input
            className="field"
            list="known-clients"
            value={client}
            placeholder="Optional"
            onChange={(e) => setClient(e.target.value)}
          />
          <datalist id="known-clients">
            {clients.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label>
          Due
          <div className="chips">
            {QUICK.map(([label, make]) => (
              <button
                key={label}
                type="button"
                className="chip"
                aria-pressed={due === at18(make())}
                onClick={() => quick(make)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className="field"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </label>

        <label>
          Priority
          <div className="chips">
            {(["high", "normal", "low"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                className="chip"
                aria-pressed={pri === p}
                onClick={() => setPri(p)}
              >
                {p === "high" ? "High" : p === "normal" ? "Normal" : "Low"}
              </button>
            ))}
          </div>
        </label>

        <div className="sheet-actions">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn is-primary" disabled={busy || !title.trim()}>
            {busy ? "Adding…" : "Add task"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Row({
  t,
  open,
  toggle,
  patch,
  drop,
}: {
  t: Task;
  open: boolean;
  toggle: () => void;
  patch: (id: string, f: Partial<Task>) => void;
  drop: (t: Task) => void;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const state = stateOf(t);
  const done = t.status === "done";
  const pri: Priority = t.priority ?? "normal";

  return (
    <li className={`task${done ? " is-done" : ""}${pri === "high" && !done ? " pri-high" : ""}`}>
      <input
        className="task-check"
        type="checkbox"
        checked={done}
        aria-label={`Mark “${t.title}” done`}
        onChange={(e) => patch(t.id, { status: e.target.checked ? "done" : "open" })}
      />

      {/* A textarea, not an input: titles wrap instead of clipping on a phone. */}
      <textarea
        className="task-title"
        rows={1}
        defaultValue={t.title}
        placeholder="What needs doing?"
        aria-label="Task"
        ref={grow}
        onInput={(e) => grow(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        onBlur={(e) => e.target.value !== t.title && patch(t.id, { title: e.target.value })}
      />

      <div className="task-meta">
        <button
          className={`pill pri is-${pri}`}
          aria-label={`Priority: ${pri}. Change`}
          title={`Priority: ${pri} — click to change`}
          onClick={() => patch(t.id, { priority: nextPriority(pri) })}
        >
          <span className="dot" aria-hidden="true" />
          {pri !== "normal" && (pri === "high" ? "High" : "Low")}
        </button>

        {editingDate || (state !== "undated" && open) ? (
          <label className="pill is-static">
            <input
              type="datetime-local"
              autoFocus
              aria-label="Due date"
              defaultValue={toInput(t.due_at)}
              onBlur={() => setEditingDate(false)}
              onChange={(e) =>
                patch(t.id, { due_at: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
            />
          </label>
        ) : state === "undated" ? (
          <button className="pill is-ghost" onClick={() => setEditingDate(true)}>
            + Due date
          </button>
        ) : (
          <button
            className={`pill${state === "overdue" ? " is-overdue" : state === "today" ? " is-today" : ""}`}
            onClick={() => setEditingDate(true)}
          >
            {/* Text, not just colour — WCAG 1.4.1 */}
            {state === "overdue" ? "Overdue · " : ""}
            {humanDue(t.due_at!)}
          </button>
        )}

        {t.source && (
          <button className="pill" aria-expanded={open} onClick={toggle}>
            {open ? "Hide" : "Source"}
          </button>
        )}
      </div>

      <button className="task-del" aria-label={`Remove “${t.title}”`} onClick={() => drop(t)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && t.source && (
        <div className="task-source">
          <strong>{t.source_kind === "whatsapp" ? "WhatsApp" : t.source_kind === "email" ? "Email" : "Note"}:</strong>{" "}
          {t.source}
        </div>
      )}
    </li>
  );
}
