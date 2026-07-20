"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6a4.6 4.6 0 0 1 1.2-3.2 4.3 4.3 0 0 1 .1-3.2s1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2a4.3 4.3 0 0 1 .1 3.2 4.6 4.6 0 0 1 1.2 3.2c0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" />
    </svg>
  );
}

export function GithubLoginButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setError(null);

    if (!isSupabaseConfigured()) {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 550));
      window.location.href = "/#onboard";
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${origin}/auth/callback`,
          skipBrowserRedirect: false,
        },
      });
      if (oauthError) throw oauthError;
      // If the SDK didn't navigate (rare), fall through manually.
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "GitHub sign-in failed";
      console.error("[auth] GitHub login failed", { message });
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={handleLogin} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          <GitHubMark className="h-4 w-4" />
        )}
        Continue with GitHub
      </Button>
      {error ? (
        <p className="max-w-md text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
