"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/* Three tabs do not fit beside the wordmark on a 375px screen — measured at
   30px of slack against a 64px tab — so below 420px they go icon-only. */
const TABS = [
  { href: "/", label: "Board", icon: <><path d="M4 6h16M4 12h16M4 18h10" /></> },
  { href: "/inbox", label: "Paste", icon: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /></> },
  { href: "/social", label: "Social", icon: <><path d="M4 20v-5M10 20V9M16 20v-8M22 20V5" /></> },
];

export default function Topbar() {
  const path = usePathname();
  const [today, setToday] = useState("");

  useEffect(() => {
    // Rendered client-side so the server's clock and timezone never leak in.
    setToday(
      new Date().toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Asia/Kolkata",
      }),
    );
  }, []);

  function flipTheme() {
    const root = document.documentElement;
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    const now = root.getAttribute("data-theme") ?? (dark ? "dark" : "light");
    root.setAttribute("data-theme", now === "dark" ? "light" : "dark");
  }

  return (
    <header className="topbar">
      <div className="grow">
        <h1 className="brand">My Todos</h1>
        <p className="today">{today || " "}</p>
      </div>
      <nav aria-label="Main">
        {TABS.map(({ href, label, icon }) => {
          const on = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <a key={href} className={`tab${on ? " on" : ""}`} href={href} aria-label={label}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {icon}
              </svg>
              <span>{label}</span>
            </a>
          );
        })}
      </nav>
      <button className="iconbtn" onClick={flipTheme} aria-label="Switch theme">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </button>
    </header>
  );
}
