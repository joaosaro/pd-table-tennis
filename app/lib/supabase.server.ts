import { createServerClient } from "@supabase/ssr";

export function createSupabaseServerClient(request: Request) {
  const cookies = parseCookies(request.headers.get("Cookie") ?? "");
  const headers = new Headers();

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(cookies).map(([name, value]) => ({
            name,
            value,
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const isProduction = process.env.NODE_ENV === "production";
            headers.append(
              "Set-Cookie",
              `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${isProduction ? "; Secure" : ""}${options?.maxAge ? `; Max-Age=${options.maxAge}` : ""}`
            );
          });
        },
      },
    }
  );

  return { supabase, headers };
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.split("=");
    if (name) {
      try {
        cookies[name.trim()] = decodeURIComponent(rest.join("=").trim());
      } catch {
        cookies[name.trim()] = rest.join("=").trim();
      }
    }
  });
  return cookies;
}
