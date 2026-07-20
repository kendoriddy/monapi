"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Code2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Experience, RuntimeMode } from "@/lib/preferences";

const EXPERIENCES: {
  id: Experience;
  label: string;
  description: string;
  icon: typeof Code2;
}[] = [
  {
    id: "publisher",
    label: "Publisher",
    description: "Build hubs & sell your API",
    icon: Code2,
  },
  {
    id: "subscriber",
    label: "Subscriber",
    description: "Browse APIs & subscribe",
    icon: ShoppingBag,
  },
];

async function savePreferences(input: {
  experience?: Experience;
  runtime?: RuntimeMode;
}) {
  await fetch("/api/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function HeaderControls({
  experience,
  runtime,
  liveAvailable,
}: {
  experience: Experience;
  runtime: RuntimeMode;
  liveAvailable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const current =
    EXPERIENCES.find((e) => e.id === experience) ?? EXPERIENCES[0];
  const CurrentIcon = current.icon;

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function switchExperience(next: Experience) {
    if (next === experience) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startTransition(async () => {
      await savePreferences({ experience: next });
      router.push("/");
      router.refresh();
    });
  }

  function switchRuntime(next: RuntimeMode) {
    if (next === runtime) return;
    if (next === "live" && !liveAvailable) return;
    startTransition(async () => {
      await savePreferences({ runtime: next });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2" ref={rootRef}>
      <div className="relative">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
          className="min-w-[9.5rem] justify-between"
        >
          <span className="flex items-center gap-1.5">
            <CurrentIcon className="h-3.5 w-3.5" />
            {current.label}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 opacity-70 transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>

        {open ? (
          <div
            role="listbox"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-xl"
          >
            {EXPERIENCES.map((item) => {
              const Icon = item.icon;
              const active = item.id === experience;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => switchExperience(item.id)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors",
                    active
                      ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--foreground)]">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div
        className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
        title={
          liveAvailable
            ? "Switch between local demo data and live Supabase"
            : "Add real Supabase credentials in .env.local to enable Live"
        }
      >
        {(["demo", "live"] as const).map((mode) => {
          const active = runtime === mode;
          const disabled = mode === "live" && !liveAvailable;
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled || pending}
              onClick={() => switchRuntime(mode)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors",
                active
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]",
                disabled &&
                  "cursor-not-allowed opacity-40 hover:text-[var(--muted)]",
              )}
            >
              {mode}
            </button>
          );
        })}
      </div>
    </div>
  );
}
