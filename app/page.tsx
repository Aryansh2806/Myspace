"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/supabase";
import { selectDue, endOfDay } from "@/lib/due.mjs";

const NOTIFY_AHEAD_MS = 2 * 60 * 60 * 1000;

const toInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInput = (v: string) => (v ? new Date(v).toISOString() : null);

function urgency(t: Task) {
  if (t.status === "done" || !t.due_at) return "";
  const due = new Date(t.due_at);
  if (due < new Date()) return "overdue";
  return due.toDateString() === new Date().toDateString() ? "today" : "";
}

export default function Board() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [todayOnly, setTodayOnly] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("denied");
  const [err, setErr] = useState("");

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

  // Nudge for anything due in the next 2 hours. localStorage keeps it to once
  // per task, so a reload or a tab left open all day doesn't re-fire.
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
        new Notification(t.client ? `${t.client} — due` : "Due", {
          body: t.title,
          tag: t.id,
        });
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
    setTasks((ts) => ts!.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
  }

  async function remove(id: string) {
    setTasks((ts) => ts!.filter((t) => t.id !== id));
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
  }

  async function add() {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New task" }),
    });
    const created = await res.json();
    setTasks((ts) => [...created, ...ts!]);
  }

  if (err)
    return (
      <p className="err">
        {err} — check the Supabase keys in <code>.env.local</code>, and that{" "}
        <code>schema.sql</code> has been run.
      </p>
    );
  if (!tasks) return <p className="muted">Loading…</p>;

  const due = selectDue(tasks, endOfDay());
  const dueIds = new Set(due.map((t) => t.id));

  const visible = tasks
    .filter((t) => showDone || t.status !== "done")
    // Anything in the "Due now" strip is not repeated under its client below.
    .filter((t) => (todayOnly ? dueIds.has(t.id) : !dueIds.has(t.id)));

  const groups = new Map<string, Task[]>();
  for (const t of visible) {
    const k = t.client ?? "No client";
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }

  return (
    <>
      {due.length > 0 && !todayOnly && (
        <>
          <h2>Due now — {due.length}</h2>
          <div className="card">
            {due.map((t) => (
              <Row key={t.id} t={t} patch={patch} remove={remove} />
            ))}
          </div>
        </>
      )}

      {[...groups.keys()].sort().map((client) => (
        <div key={client}>
          <h2>{client}</h2>
          <div className="card">
            {groups.get(client)!.map((t) => (
              <Row key={t.id} t={t} patch={patch} remove={remove} />
            ))}
          </div>
        </div>
      ))}

      {visible.length === 0 && due.length === 0 && (
        <p className="muted">
          {todayOnly ? (
            "Nothing due today."
          ) : (
            <>
              Nothing here. <a href="/inbox">Paste a message</a> to get started.
            </>
          )}
        </p>
      )}

      <div className="bar">
        <button className="ghost" onClick={add}>
          + Task
        </button>
        <label className="muted">
          <input type="checkbox" checked={todayOnly} onChange={(e) => setTodayOnly(e.target.checked)} />{" "}
          today only
        </label>
        <label className="muted">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> show
          done
        </label>
        {perm === "default" && (
          <button className="ghost" onClick={() => Notification.requestPermission().then(setPerm)}>
            Enable reminders
          </button>
        )}
        {perm === "denied" && <span className="muted">Reminders blocked in browser settings.</span>}
      </div>
    </>
  );
}

function Row({
  t,
  patch,
  remove,
}: {
  t: Task;
  patch: (id: string, f: Partial<Task>) => void;
  remove: (id: string) => void;
}) {
  return (
    <div className={`row ${urgency(t)} ${t.status === "done" ? "done" : ""}`}>
      <input
        type="checkbox"
        checked={t.status === "done"}
        onChange={(e) => patch(t.id, { status: e.target.checked ? "done" : "open" })}
      />
      <input
        type="text"
        defaultValue={t.title}
        title={t.source ?? ""}
        onBlur={(e) => e.target.value !== t.title && patch(t.id, { title: e.target.value })}
      />
      <input
        type="datetime-local"
        defaultValue={toInput(t.due_at)}
        onChange={(e) => patch(t.id, { due_at: fromInput(e.target.value) })}
      />
      <button className="x" onClick={() => remove(t.id)} title="delete">
        ×
      </button>
    </div>
  );
}
