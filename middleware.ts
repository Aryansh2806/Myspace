import { NextResponse, type NextRequest } from "next/server";

// Single user. A password in an env var and a cookie is the whole auth story.
// Fails CLOSED in production: deployed without APP_PASSWORD, nothing is served.
export function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    if (process.env.VERCEL) {
      return new NextResponse("APP_PASSWORD is not set. Refusing to serve.", { status: 503 });
    }
    return NextResponse.next(); // local dev
  }
  if (req.cookies.get("auth")?.value === pw) return NextResponse.next();

  const given = req.nextUrl.searchParams.get("pw");
  if (given === pw) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("pw");
    const res = NextResponse.redirect(url);
    res.cookies.set("auth", pw, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });
    return res;
  }
  return new NextResponse(loginPage(given !== null), {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// /api/cron is excluded: it authenticates with CRON_SECRET instead.
/** A password wall with no input field is a dead end. This is that field. */
function loginPage(wrong: boolean) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>My Todos</title><style>
:root{--bg:#f7f7f6;--surface:#fff;--text:#1a1a19;--muted:#5f5f5a;--line:#d8d8d1;--danger:#a92f1e;color-scheme:light}
@media(prefers-color-scheme:dark){:root{--bg:#121211;--surface:#1c1c1a;--text:#ececea;--muted:#a3a39c;--line:#3a3936;--danger:#ff9083;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;
background:var(--bg);color:var(--text);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
form{width:100%;max-width:320px}
h1{font-size:20px;font-weight:650;margin:0 0 4px}
p{color:var(--muted);font-size:14px;margin:0 0 20px}
input,button{width:100%;font:inherit}
input{padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:inherit;margin-bottom:10px}
button{padding:13px;border:0;border-radius:12px;background:var(--text);color:var(--bg);font-weight:600;cursor:pointer}
.e{color:var(--danger);font-size:14px;margin:0 0 12px}
</style></head><body>
<form method="GET" action="/">
<h1>My Todos</h1><p>Enter your password to continue.</p>
${wrong ? '<p class="e">That password is not right.</p>' : ""}
<input type="password" name="pw" autofocus autocomplete="current-password" aria-label="Password" placeholder="Password">
<button type="submit">Continue</button>
</form></body></html>`;
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
