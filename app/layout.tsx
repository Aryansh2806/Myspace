import "./globals.css";
import Topbar from "./topbar";

export const metadata = { title: "My Todos" };
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edf1f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e15" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&display=swap"
        />
      </head>
      <body>
        <div className="aurora" aria-hidden="true">
          <i className="a" />
          <i className="b" />
          <i className="c" />
        </div>
        <div className="shell">
          <Topbar />
          {children}
        </div>
      </body>
    </html>
  );
}
