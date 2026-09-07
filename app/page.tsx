"use client";

import { useEffect, useRef, useState } from "react";
import type { Task } from "@/lib/supabase";
import { selectDue, endOfDay, sortTasks, nextPriority, sortManual, positionFor } from "@/lib/due.mjs";
import type { Priority } from "@/lib/supabase";
import { Spring, project, rubberband, velocityFrom } from "@/lib/spring.mjs";
import { streakLength, history } from "@/lib/streak.mjs";

const NOTIFY_AHEAD_MS = 2 * 60 * 60 * 1000;
const SWIPE_COMMIT = 92;   // px the row must reach — or be thrown past — to complete

const reducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Consecutive days you finished something. Amber already means "due today",
    so the streak gets its own colour rather than overloading it. */
function Streak({ days }: { days: number }) {
  const flame = useRef<SVGPathElement>(null);
  const seen = useRef(days);
  useEffect(() => {
    if (days > seen.current && flame.current && !reducedMotion()) {
      const el = flame.current;
      const s = new Spring(1, { response: 0.4, damping: 0.6, onUpdate: (v) => (el.style.transform = `scale(${v})`) });
      s.onRest = () => { s.onRest = () => {}; s.to(1); };
      s.to(1.35);
    }
    seen.current = days;
  }, [days]);

  return (
    <span className={`streak${days === 0 ? " is-cold" : ""}`} title="Days in a row you finished something">
      <svg width="13" height="15" viewBox="0 0 15 17" fill="none" aria-hidden="true">
        <path ref={flame} className="flame"
          d="M7.5 1S3 5 3 9a4.5 4.5 0 1 0 9 0c0-1.6-.9-3-1.8-4 .2 1.4-.5 2.3-1.2 2.3C7.7 7.3 7.5 4.6 7.5 1Z"
          fill="currentColor" />
      </svg>
      {days}
      <span className="sr-only"> day streak</span>
    </span>
  );
}

/** Seven days of finished work. A quiet day is a zero-height bar, not a gap. */
function History({ days, streak }: { days: { day: string; count: number }[]; streak: number }) {
  const peak = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((a, d) => a + d.count, 0);
  return (
    <div className="history-wrap">
      <div className="history" role="img" aria-label={`${total} finished in the last 7 days`}>
        {days.map((d, i) => (
          <i
            key={d.day}
            className={i === days.length - 1 ? "is-today" : ""}
            style={{ ["--h" as string]: `${(d.count / peak) * 100}%` }}
            title={`${new Date(d.day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: ${d.count}`}
          />
        ))}
      </div>
      <div className="history-cap">
        <Streak days={streak} />
        <span className="total">{total} finished in 7 days</span>
      </div>
    </div>
  );
}

/** A +1 that travels to the ring — motion that points at the outcome. */
function flyPlusOne(from: HTMLElement) {
  if (reducedMotion()) return;
  const ring = document.querySelector(".ring");
  if (!ring) return;
  const a = from.getBoundingClientRect();
  const b = ring.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "plusone";
  el.textContent = "+1";
  el.style.left = `${a.left + 24}px`;
  el.style.top = `${a.top + a.height / 2 - 10}px`;
  document.body.appendChild(el);
  const dx = b.left + b.width / 2 - (a.left + 24);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  let cx = 0, cy = 0;
  const paint = () => {
    el.style.transform = `translate3d(${cx * dx}px, ${cy * dy}px, 0) scale(${1 - cx * 0.35})`;
    el.style.opacity = String(1 - cx * 0.65);
  };
  // X and Y as independent springs: one spring on a 2D distance desyncs.
  const sx = new Spring(0, { response: 0.55, onUpdate: (v) => { cx = v; paint(); } });
  const sy = new Spring(0, { response: 0.62, onUpdate: (v) => { cy = v; paint(); } });
  sy.onRest = () => el.remove();
  sx.to(1);
  sy.to(1);
}

/** Done vs everything still on the board. Springs so a completion feels earned. */
function Ring({ done, total }: { done: number; total: number }) {
  const R = 36;
  const C = 2 * Math.PI * R;
  const circle = useRef<SVGCircleElement>(null);
  const label = useRef<HTMLElement>(null);
  const spring = useRef<Spring | null>(null);
  const count = useRef<Spring | null>(null);

  useEffect(() => {
    const pct = total ? done / total : 0;
    if (!spring.current) {
      // First paint is at rest — no counting up from zero on load.
      spring.current = new Spring(pct, {
        response: 0.55, reduced: reducedMotion(),
        onUpdate: (v) => circle.current?.setAttribute("stroke-dashoffset", String(C * (1 - v))),
      });
      count.current = new Spring(done, {
        response: 0.5, reduced: reducedMotion(),
        onUpdate: (v) => { if (label.current) label.current.textContent = String(Math.round(v)); },
      });
      spring.current.set(pct);
      count.current.set(done);
    } else {
      spring.current.to(pct);
      count.current!.to(done);
    }
  }, [done, total, C]);

  return (
    <div className="ring">
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
        <circle className="track" cx="42" cy="42" r={R} fill="none" strokeWidth="7" />
        <circle
          ref={circle} className="fill" cx="42" cy="42" r={R} fill="none" strokeWidth="7"
          strokeDasharray={C} strokeDashoffset={C}
        />
      </svg>
      <p className="cap">
        <b ref={label}>{done}</b>
        <span>of {total}</span>
      </p>
      <span className="sr-only">
        {done} of {total} done
      </span>
    </div>
  );
}

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
  const [manual, setManual] = useState(false);
  const [drag, setDrag] = useState<{ id: string; group: string; to: number } | null>(null);
  const [filterClient, setFilterClient] = useState<string | null>(null);
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
    try {
      setManual(localStorage.getItem("sort") === "manual");
    } catch {}
  }, []);

  function setSort(m: boolean) {
    setManual(m);
    try {
      localStorage.setItem("sort", m ? "manual" : "auto");
    } catch {}
  }

  /** Commit a move within one client group. Only the moved row changes. */
  async function move(list: Task[], from: number, to: number) {
    if (to === from || to < 0 || to > list.length) return;
    const t = list[from];
    const position = positionFor(list, from, to > from ? to - 1 : to);
    setTasks((ts) => ts!.map((x) => (x.id === t.id ? { ...x, position } : x)));
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, position }),
    });
    if (!res.ok) {
      setErr("Could not save the new order.");
      load();
    }
  }

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
    const peers = tasks!.filter((t) => (t.client?.trim() || "") === draft.client.trim());
    const top = Math.min(...peers.map((t) => t.position ?? 0), 0);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, source_kind: "note", position: top - 1000 }),
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

  const streak = streakLength(tasks);
  const week = history(tasks);

  const visible = tasks
    .filter((t) => showDone || t.status !== "done")
    .filter((t) => filter === "all" || dueIds.has(t.id))
    .filter((t) => !filterClient || (t.client?.trim() || "Unassigned") === filterClient);

  const doneCount = tasks.length - live.length;
  const headline =
    counts.open === 0
      ? "Queue clear. Everything shipped."
      : `${doneCount === 0 ? "Nothing" : doneCount} done. ${counts.open} to go.`;
  const clients = [...new Set(tasks.map((t) => t.client?.trim() || "Unassigned"))].sort((a, b) =>
    a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b),
  );
  const ordered = manual ? sortManual(visible) : sortTasks(visible);


  return (
    <>
      <div className="hero">
        <Ring done={doneCount} total={tasks.length} />
        <div>
          <h2 className="heroline">{headline}</h2>
          <div className="herofacts">
            {counts.overdue > 0 && (
              <span className="fact is-danger"><b>{counts.overdue}</b> overdue</span>
            )}
            {counts.today > 0 && (
              <span className="fact is-warn"><b>{counts.today}</b> due today</span>
            )}
            <span className="fact"><b>{counts.open}</b> open</span>
            <span className="fact"><b>{counts.undated}</b> undated</span>
          </div>
        </div>
      </div>

      <History days={week} streak={streak} />

      {err && <p className="err">{err}</p>}

      {clients.length > 1 && (
        <>
          <h2 className="railhead">
            Clients <span className="n">{clients.length}</span>
          </h2>
          <div className="rail">
            {clients.map((name) => {
              const mine = tasks.filter((t) => (t.client?.trim() || "Unassigned") === name);
              const d = mine.filter((t) => t.status === "done").length;
              return (
                <button
                  key={name}
                  className="client"
                  aria-pressed={filterClient === name}
                  onClick={() => setFilterClient(filterClient === name ? null : name)}
                >
                  <span className="cname">{name}</span>
                  <span className="minibar">
                    <i style={{ width: `${mine.length ? (d / mine.length) * 100 : 0}%` }} />
                  </span>
                  <span className="cmeta">
                    {d}/{mine.length} done
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <h2 className="railhead">
        {filterClient ?? "Queue"} <span className="n">{visible.length}</span>
        {filterClient && (
          <button className="pill" onClick={() => setFilterClient(null)} style={{ marginLeft: "auto" }}>
            Show all
          </button>
        )}
      </h2>

      {visible.length === 0 ? (
        <div className="empty">
          <p>{filter === "due" ? "Nothing due today." : "No tasks here yet."}</p>
          {filter === "all" && !filterClient && (
            <a className="btn is-primary" href="/inbox">
              Paste a message
            </a>
          )}
        </div>
      ) : (
        <ul className="stream">
          {ordered.map((t, i) => (
            <Row
              key={t.id}
              t={t}
              index={i}
              list={ordered}
              manual={manual}
              drag={drag}
              setDrag={setDrag}
              move={move}
              group="stream"
              showClient={!filterClient}
              open={open === t.id}
              toggle={() => setOpen(open === t.id ? null : t.id)}
              patch={patch}
              drop={drop}
            />
          ))}
        </ul>
      )}

      <div className="bar">

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
        <button
          className="toggle sortmode"
          onClick={() => setSort(!manual)}
          title={manual ? "Ordered by hand" : "Ordered by priority, then due date"}
        >
          Sort: {manual ? "Manual" : "Auto"}
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

      <div className="dock">
        <button className="fab" onClick={() => setAdding(true)}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New task
        </button>
      </div>

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

type Drag = { id: string; group: string; to: number } | null;

function clientPct(list: Task[]) {
  if (!list.length) return 0;
  return (list.filter((t) => t.status === "done").length / list.length) * 100;
}

function Row({
  t,
  index,
  list,
  manual,
  drag,
  setDrag,
  move,
  group,
  showClient,
  open,
  toggle,
  patch,
  drop,
}: {
  t: Task;
  index: number;
  list: Task[];
  manual: boolean;
  showClient: boolean;
  drag: Drag;
  setDrag: (d: Drag) => void;
  move: (list: Task[], from: number, to: number) => void;
  group: string;
  open: boolean;
  toggle: () => void;
  patch: (id: string, f: Partial<Task>) => void;
  drop: (t: Task) => void;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const state = stateOf(t);
  const done = t.status === "done";
  const pri: Priority = t.priority ?? "normal";
  const dragging = drag?.id === t.id;
  const rowEl = useRef<HTMLDivElement>(null);
  const behindEl = useRef<HTMLDivElement>(null);
  const swipe = useRef<Spring | null>(null);

  /* Swipe right to complete. 1:1 with the finger; whether it commits is
     decided by PROJECTED momentum, so a fast flick from halfway still lands.
     touch-action: pan-y on the wrapper leaves vertical scrolling to the
     browser, and the gesture never starts on a control or the text field. */
  function swipeStart(e: React.PointerEvent<HTMLLIElement>) {
    if (done || e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("button, input, textarea, label, a")) return;

    const li = e.currentTarget;
    const width = li.offsetWidth;
    if (!swipe.current) {
      swipe.current = new Spring(0, {
        response: 0.35,
        reduced: reducedMotion(),
        onUpdate: (v) => {
          if (rowEl.current) rowEl.current.style.transform = `translate3d(${v}px,0,0)`;
          if (behindEl.current) behindEl.current.style.opacity = String(Math.min(1, v / SWIPE_COMMIT));
        },
      });
    }
    const sp = swipe.current;
    sp.halt(); // grab it mid-flight rather than waiting for it to settle

    const startX = e.clientX;
    const base = sp.x;
    const hist = [{ p: e.clientX, t: performance.now() }];
    let committed = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!committed) {
        if (Math.abs(dx) < 10) return;                 // hysteresis
        if (Math.abs(dx) < Math.abs(ev.clientY - e.clientY)) return; // it's a scroll
        committed = true;
        li.classList.add("is-swiping");
        li.setPointerCapture(ev.pointerId);
      }
      hist.push({ p: ev.clientX, t: performance.now() });
      if (hist.length > 6) hist.shift();
      let next = base + dx;
      if (next < 0) next = -rubberband(-next, width);  // leftwards is not a gesture here
      sp.set(next);
    };

    const onUp = (ev: PointerEvent) => {
      li.removeEventListener("pointermove", onMove);
      li.removeEventListener("pointerup", onUp);
      li.removeEventListener("pointercancel", onUp);
      if (!committed) return;
      const unsolidify = () => li.classList.remove("is-swiping");
      hist.push({ p: ev.clientX, t: performance.now() });
      const v = velocityFrom(hist, performance.now());
      if (sp.x + project(v) > SWIPE_COMMIT) {
        if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
        // Write first, animate second. Gating the save on onRest loses the
        // completion whenever rAF is throttled — a backgrounded tab, a
        // low-power device — and the row would slide away having saved nothing.
        if (rowEl.current) flyPlusOne(rowEl.current);
        patch(t.id, { status: "done" });
        sp.onRest = () => { sp.onRest = () => {}; unsolidify(); };
        sp.to(width, v);
      } else {
        sp.damping = Math.abs(v) > 320 ? 0.8 : 1;      // bounce only after a real flick
        sp.onRest = () => { sp.onRest = () => {}; unsolidify(); };
        sp.to(0, v);
      }
    };

    li.addEventListener("pointermove", onMove);
    li.addEventListener("pointerup", onUp);
    li.addEventListener("pointercancel", onUp);
  }
  const dropHere = drag?.group === group && drag.to === index && drag.id !== t.id;

  /* Drag lives on the handle only, so a swipe anywhere else still scrolls the
     page. Rows are measured once at pointerdown and never reordered mid-drag,
     so the rects stay valid and the maths cannot drift. */
  function startDrag(e: React.PointerEvent<HTMLButtonElement>) {
    const ul = e.currentTarget.closest("ul");
    if (!ul) return;
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const rows = [...ul.querySelectorAll("li")].map((li) => {
      const r = li.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    setDrag({ id: t.id, group, to: index });

    const onMove = (ev: PointerEvent) => {
      let to = rows.findIndex((mid) => ev.clientY < mid);
      if (to === -1) to = rows.length;
      setDrag({ id: t.id, group, to });
    };
    const onUp = (ev: PointerEvent) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      let to = rows.findIndex((mid) => ev.clientY < mid);
      if (to === -1) to = rows.length;
      setDrag(null);
      move(list, index, to);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  /* WCAG 2.5.7: every drag needs a single-pointer / keyboard alternative. */
  function onGripKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      move(list, index, e.key === "ArrowUp" ? index - 1 : index + 2);
    }
  }

  return (
    <li className="swipe" onPointerDown={swipeStart}>
      <div className="behind" ref={behindEl} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5 9.5 18 20 6.5" />
        </svg>
        Done
      </div>
      <div
        ref={rowEl}
        className={
          `task${done ? " is-done" : ""}${pri === "high" && !done ? " pri-high" : ""}` +
          `${manual ? " has-grip" : ""}${dragging ? " is-dragging" : ""}${dropHere ? " drop-here" : ""}`
        }
      >
      {manual && (
        <button
          className="grip"
          onPointerDown={startDrag}
          onKeyDown={onGripKey}
          aria-label={`Reorder “${t.title}”, ${index + 1} of ${list.length}. Use arrow keys.`}
          title="Drag to reorder, or focus and use arrow keys"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
            <circle cx="6" cy="3" r="1.35" /><circle cx="10" cy="3" r="1.35" />
            <circle cx="6" cy="8" r="1.35" /><circle cx="10" cy="8" r="1.35" />
            <circle cx="6" cy="13" r="1.35" /><circle cx="10" cy="13" r="1.35" />
          </svg>
        </button>
      )}
      <input
        className="task-check"
        type="checkbox"
        checked={done}
        aria-label={`Mark “${t.title}” done`}
        onChange={(e) => {
          if (e.target.checked && rowEl.current) flyPlusOne(rowEl.current);
          patch(t.id, { status: e.target.checked ? "done" : "open" });
        }}
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
        {showClient && t.client?.trim() && (
          <span className="pill is-static client-pill">{t.client.trim()}</span>
        )}
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
      </div>
    </li>
  );
}
