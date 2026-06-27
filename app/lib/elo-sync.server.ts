import type { Match } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function syncEditionMatchToElo(
  supabase: SupabaseClientLike,
  match: Pick<
    Match,
    | "id"
    | "player1_id"
    | "player2_id"
    | "winner_id"
    | "status"
    | "set1_p1"
    | "set1_p2"
    | "set2_p1"
    | "set2_p2"
    | "set3_p1"
    | "set3_p2"
    | "recorded_by"
    | "recorded_at"
    | "created_at"
  >,
) {
  if (match.status !== "completed" || !match.winner_id) {
    await supabase
      .from("elo_matches")
      .delete()
      .eq("source_type", "edition_match")
      .eq("source_match_id", match.id);
    return;
  }

  const eloPayload = {
    source_type: "edition_match",
    source_match_id: match.id,
    player1_id: match.player1_id,
    player2_id: match.player2_id,
    winner_id: match.winner_id,
    played_at: match.recorded_at || match.created_at,
    set1_p1: match.set1_p1,
    set1_p2: match.set1_p2,
    set2_p1: match.set2_p1,
    set2_p2: match.set2_p2,
    set3_p1: match.set3_p1,
    set3_p2: match.set3_p2,
    recorded_by: match.recorded_by,
  };

  const { data: existingEloMatch } = await supabase
    .from("elo_matches")
    .select("id")
    .eq("source_type", "edition_match")
    .eq("source_match_id", match.id)
    .maybeSingle();

  if (existingEloMatch) {
    await supabase
      .from("elo_matches")
      .update(eloPayload)
      .eq("id", existingEloMatch.id);
    return;
  }

  await supabase.from("elo_matches").insert(eloPayload);
}
