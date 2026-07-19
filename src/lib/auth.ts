import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo-store";

export async function getCurrentUser() {
  if (isDemoMode()) {
    return {
      id: "demo-developer",
      email: "dev@monapi.local",
      fullName: "Demo Developer",
      isDemo: true as const,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    fullName:
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      null,
    isDemo: false as const,
  };
}
