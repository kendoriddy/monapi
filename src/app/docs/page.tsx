import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getHeaderState } from "@/lib/header-state";

const envVars = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL"],
  [
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "Supabase anon/public key (or PUBLISHABLE_KEY)",
  ],
  ["SUPABASE_SERVICE_ROLE_KEY", "Service role (webhooks + gateway)"],
  ["MONNIFY_API_KEY", "Monnify Sandbox API key"],
  ["MONNIFY_SECRET_KEY", "Monnify secret + webhook HMAC"],
  ["MONNIFY_CONTRACT_CODE", "Monnify contract code"],
  ["OPENAI_API_KEY or GEMINI_API_KEY", "AI tiers + docs"],
  ["RESEND_API_KEY", "API key delivery emails"],
  ["MONAPI_DEMO_MODE", "Force demo store (locks Live if true)"],
  ["MONAPI_GATEWAY_MOCK", "Always mock gateway responses"],
];

export default async function DocsPage() {
  const { experience, runtime, liveAvailable, liveBlockedReason } =
    await getHeaderState();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        experience={experience}
        runtime={runtime}
        liveAvailable={liveAvailable}
        liveBlockedReason={liveBlockedReason}
        right={
          <Link href="/">
            <Button size="sm">Back to app</Button>
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-12 sm:px-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
            Setup & pitch demo checklist
          </h1>
          <p className="mt-2 text-[var(--muted)]">
            See also the repository{" "}
            <Link href="/" className="text-[var(--accent)] underline">
              README
            </Link>
            .
          </p>
        </div>

        <ol className="space-y-4 text-sm text-[var(--muted)]">
          <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-semibold text-[var(--foreground)]">
              Zero-config demo (judges / recording)
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1">
              <li>GitHub login beat → onboard PlateReader OCR</li>
              <li>Publish → `/p/plate-reader` with docs + curl</li>
              <li>Pro ₦15,000 → simulated Monnify → success + inbox</li>
              <li>Run request on gateway with new key</li>
            </ul>
          </li>
          <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-semibold text-[var(--foreground)]">Install</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--background)] p-3 font-mono text-xs text-[var(--foreground)]">
              {`npm install
cp .env.example .env.local
npm run dev`}
            </pre>
          </li>
          <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-semibold text-[var(--foreground)]">Database</p>
            <p className="mt-2">
              New:{" "}
              <code className="text-[var(--accent)]">supabase/schema.sql</code>.
              Existing:{" "}
              <code className="text-[var(--accent)]">
                supabase/migration-demo-fields.sql
              </code>
            </p>
          </li>
          <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-semibold text-[var(--foreground)]">
              Environment variables
            </p>
            <ul className="mt-3 space-y-2">
              {envVars.map(([key, desc]) => (
                <li key={key}>
                  <code className="text-[var(--accent)]">{key}</code>
                  <span> — {desc}</span>
                </li>
              ))}
            </ul>
          </li>
        </ol>
      </main>
    </div>
  );
}
