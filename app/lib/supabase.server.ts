import { createArchiveClient } from "./archive-db.server";

/**
 * The Supabase database has been retired. All data is now served from the
 * read-only archive in `app/data/archive` (see `archive-db.server.ts`).
 */
export function createSupabaseServerClient(_request: Request) {
  return { supabase: createArchiveClient(), headers: new Headers() };
}
