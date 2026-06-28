import { buildEloRatings } from "./elo.server";
import type { Match, Player } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function rebuildEloRatings(supabase: SupabaseClientLike) {
  const [
    { data: players, error: playersError },
    { data: matches, error: matchesError },
  ] = await Promise.all([
    supabase.from("players").select("*").order("name"),
    supabase
      .from("edition_matches")
      .select(
        "id, season, player1_id, player2_id, winner_id, recorded_at, created_at",
      )
      .eq("status", "completed"),
  ]);

  if (playersError) {
    throw new Error(playersError.message);
  }

  if (matchesError) {
    throw new Error(matchesError.message);
  }

  const { historyRows, playerRatings } = buildEloRatings(
    (players as Player[]) || [],
    (matches as Match[]) || [],
  );

  const { error: deleteHistoryError } = await supabase
    .from("elo_rating_history")
    .delete()
    .gte("season", 1);

  if (deleteHistoryError) {
    throw new Error(deleteHistoryError.message);
  }

  const { error: deleteRatingsError } = await supabase
    .from("player_elo_ratings")
    .delete()
    .gte("rated_games", 0);

  if (deleteRatingsError) {
    throw new Error(deleteRatingsError.message);
  }

  if (historyRows.length > 0) {
    const { error: insertHistoryError } = await supabase
      .from("elo_rating_history")
      .insert(historyRows);

    if (insertHistoryError) {
      throw new Error(insertHistoryError.message);
    }
  }

  const { error: upsertRatingsError } = await supabase
    .from("player_elo_ratings")
    .upsert(playerRatings, { onConflict: "player_id" });

  if (upsertRatingsError) {
    throw new Error(upsertRatingsError.message);
  }
}
