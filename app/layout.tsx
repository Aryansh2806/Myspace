import "./globals.css";

export const metadata = { title: "My Todos" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <nav>
            <h1>My Todos</h1>
            <a href="/">Board</a>
            <a href="/inbox">Paste</a>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
