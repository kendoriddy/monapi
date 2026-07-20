import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * OAuth PKCE callback. Session cookies must be written onto the redirect
 * response itself — Next.js does not propagate cookies().set() onto a later
 * NextResponse.redirect().
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  let next = searchParams.get("next") ?? "/";
  if (!next.startsWith("/")) next = "/";

  if (oauthError) {
    console.error("[auth/callback] provider error", {
      oauthError,
      oauthErrorDescription,
    });
    const message = encodeURIComponent(
      oauthErrorDescription || oauthError || "GitHub sign-in failed",
    );
    return NextResponse.redirect(`${origin}/?authError=${message}`);
  }

  if (code) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.redirect(
        `${origin}/?authError=${encodeURIComponent("Supabase is not configured")}`,
      );
    }

    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Keep Live mode selected after a successful real sign-in.
      response.cookies.set("monapi_runtime", "live", {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
    }

    console.error("[auth/callback] exchange failed", {
      message: error.message,
    });
    return NextResponse.redirect(
      `${origin}/?authError=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/?authError=${encodeURIComponent("Missing auth code from GitHub")}`,
  );
}
