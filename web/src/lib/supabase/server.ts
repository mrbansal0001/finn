import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

/** Per-request client bound to the visitor's session cookies (RLS applies as that user). */
export async function supabaseForRequest() {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (toSet) => {
        // Server Components can't set cookies; the proxy refreshes them before render.
        try {
          for (const { name, value, options } of toSet) jar.set(name, value, options);
        } catch {}
      },
    },
  });
}
