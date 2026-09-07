import { NextResponse, type NextRequest } from "next/server";

// Single user. A password in an env var and a cookie is the whole auth story.
// Fails CLOSED in production: deployed without APP_PASSWORD, nothing is served.
/** Length-independent compare, so a wrong guess cannot be timed character by character. */
function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) {
    if (process.env.VERCEL) {
      return new NextResponse("APP_PASSWORD is not set. Refusing to serve.", { status: 503 });
    }
    return NextResponse.next(); // local dev
  }
  if (sameSecret(req.cookies.get("auth")?.value ?? "", pw)) return NextResponse.next();

  const given = req.nextUrl.searchParams.get("pw");
  if (given !== null && sameSecret(given, pw)) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("pw");
    const res = NextResponse.redirect(url);
    res.cookies.set("auth", pw, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });
    return res;
  }
  // A short delay on every wrong answer. A 6-digit PIN is only a million
  // guesses; unthrottled that falls in minutes, and this makes each attempt
  // cost real time. It is not a substitute for a proper rate limit.
  if (given !== null) await new Promise((r) => setTimeout(r, 500));

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
.pin{text-align:center;font-size:22px;letter-spacing:.5em;text-indent:.5em;font-variant-numeric:tabular-nums}
</style></head><body>
<form method="GET" action="/">
<h1>My Todos</h1><p>Enter your passcode to continue.</p>
${wrong ? '<p class="e">That passcode is not right.</p>' : ""}
<input type="password" name="pw" autofocus inputmode="numeric" pattern="[0-9]*"
 autocomplete="current-password" aria-label="Passcode" placeholder="Passcode"
 class="pin">
<button type="submit">Continue</button>
</form></body></html>`;
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
