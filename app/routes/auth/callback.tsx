import { redirect } from "react-router";
import type { Route } from "./+types/callback";
import { createSupabaseServerClient } from "~/lib/supabase.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectParam = url.searchParams.get("redirect") || "/";

  // Validate redirect URL to prevent open redirect attacks
  const redirectTo = redirectParam.startsWith("/") ? redirectParam : "/";

  if (code) {
    const { supabase, headers } = createSupabaseServerClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirect(redirectTo, { headers });
    }

    console.error("Auth callback error:", error);
  }

  return redirect("/login?error=auth_failed");
}

export default function Callback() {
  return (
    <main className="callback-page">
      <p>Completing sign in...</p>
    </main>
  );
}
