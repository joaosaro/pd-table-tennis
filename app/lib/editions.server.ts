import type { SupabaseClient } from "@supabase/supabase-js";
import type { Edition, Player } from "~/lib/types";

export interface EditionSummary extends Edition {
  champion: Player | null;
  finalMatchId: string | null;
}

export async function getActiveEdition(
  supabase: SupabaseClient,
): Promise<Edition | null> {
  const { data: activeEdition } = await supabase
    .from("editions")
    .select("*")
    .eq("status", "active")
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (activeEdition as Edition | null) || null;
}

export async function getLatestEdition(
  supabase: SupabaseClient,
): Promise<Edition | null> {
  const { data: latestEdition } = await supabase
    .from("editions")
    .select("*")
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (latestEdition as Edition | null) || null;
}

export async function getEditionForRequest(
  supabase: SupabaseClient,
  editionId: string | null,
): Promise<Edition | null> {
  if (!editionId) {
    return getLatestEdition(supabase);
  }

  const { data: edition } = await supabase
    .from("editions")
    .select("*")
    .eq("id", editionId)
    .maybeSingle();

  return (edition as Edition | null) || null;
}

export async function listArchivedEditionSummaries(
  supabase: SupabaseClient,
  limit?: number,
): Promise<EditionSummary[]> {
  let query = supabase
    .from("editions")
    .select("*")
    .eq("status", "archived")
    .order("season", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data: editions } = await query;
  return attachChampions(supabase, (editions as Edition[]) || []);
}

async function attachChampions(
  supabase: SupabaseClient,
  editions: Edition[],
): Promise<EditionSummary[]> {
  if (editions.length === 0) {
    return [];
  }

  const { data: finals } = await supabase
    .from("edition_matches")
    .select(
      `
      id,
      edition_id,
      winner_id,
      winner:players!edition_matches_winner_id_fkey(*)
    `,
    )
    .in(
      "edition_id",
      editions.map((edition) => edition.id),
    )
    .eq("phase", "final")
    .eq("status", "completed");

  const finalByEditionId = new Map<
    string,
    { id: string; winner: Player | null }
  >(
    (
      (finals as Array<{
        id: string;
        edition_id: string;
        winner: Player[] | Player | null;
      }>) || []
    ).map((match) => [
      match.edition_id,
      {
        id: match.id,
        winner: Array.isArray(match.winner)
          ? (match.winner[0] ?? null)
          : match.winner,
      },
    ]),
  );

  return editions.map((edition) => {
    const final = finalByEditionId.get(edition.id);
    return {
      ...edition,
      champion: final?.winner || null,
      finalMatchId: final?.id || null,
    };
  });
}

export function formatEditionLabel(edition: Pick<Edition, "season">) {
  return `Session ${edition.season}`;
}
