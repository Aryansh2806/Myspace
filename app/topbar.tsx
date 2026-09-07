"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
        <a className={`tab${path === "/" ? " on" : ""}`} href="/">
          Board
        </a>
        <a className={`tab${path === "/inbox" ? " on" : ""}`} href="/inbox">
          Paste
        </a>
      </nav>
      <button className="iconbtn" onClick={flipTheme} aria-label="Switch theme">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </button>
    </header>
  );
}
