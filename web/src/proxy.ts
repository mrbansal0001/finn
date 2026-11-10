import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL, supabaseEnabled } from "@/lib/supabase/config";

/**
 * Gives every visitor a session before render. First-time visitors get an anonymous
 * Supabase user; a database trigger copies the synthetic demo network into rows only
 * they can read (row-level security). No sign-up wall for reviewers.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!supabaseEnabled) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) await supabase.auth.signInAnonymously();
  return response;
}

export const config = {
  // pages only; skip static assets, icons and the manifest
  matcher: ["/((?!_next/|icon|apple-icon|manifest|.*\\.(?:png|svg|ico|webmanifest)$).*)"],
};
