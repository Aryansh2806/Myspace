import "./globals.css";

export const metadata = { title: "My Todos" };
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="aurora" aria-hidden="true">
          <i className="a" /><i className="b" /><i className="c" />
        </div>
        <div className="shell">
          <header className="topbar">
            <h1 className="brand">My Todos</h1>
            <Nav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

function Nav() {
  return (
    <nav aria-label="Main">
      <a className="tab" href="/">
        Board
      </a>
      <a className="tab" href="/inbox">
        Paste
      </a>
    </nav>
  );
}
