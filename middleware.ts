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
  return new NextResponse("Add ?pw=... to the URL.", { status: 401 });
}

// /api/cron is excluded: it authenticates with CRON_SECRET instead.
export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
