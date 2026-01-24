import type { Player, Match } from "./types";

export interface RecommendedMatch {
  player1_id: string;
  player2_id: string;
  is_extra_match: boolean;
}

/**
 * Generate weekly match recommendations.
 * Priority: Pair players who haven't played each other in the league.
 * If odd number, one player gets a second match.
 */
export function generateRecommendations(
  selectedPlayers: Player[],
  completedLeagueMatches: Match[]
): RecommendedMatch[] {
  if (selectedPlayers.length < 2) {
    return [];
  }

  // Build a set of completed match pairs (as sorted id strings)
  const playedPairs = new Set<string>();
  for (const match of completedLeagueMatches) {
    const pairKey = [match.player1_id, match.player2_id].sort().join("-");
    playedPairs.add(pairKey);
  }

  // Find all unplayed pairs among selected players
  const unplayedPairs: [Player, Player][] = [];
  for (let i = 0; i < selectedPlayers.length; i++) {
    for (let j = i + 1; j < selectedPlayers.length; j++) {
      const pairKey = [selectedPlayers[i].id, selectedPlayers[j].id]
        .sort()
        .join("-");
      if (!playedPairs.has(pairKey)) {
        unplayedPairs.push([selectedPlayers[i], selectedPlayers[j]]);
      }
    }
  }

  // Greedy matching: Each player gets one match, prioritizing unplayed matchups
  const recommendations: RecommendedMatch[] = [];
  const usedPlayers = new Set<string>();

  // First pass: Assign unplayed matchups
  for (const [p1, p2] of unplayedPairs) {
    if (!usedPlayers.has(p1.id) && !usedPlayers.has(p2.id)) {
      recommendations.push({
        player1_id: p1.id,
        player2_id: p2.id,
        is_extra_match: false,
      });
      usedPlayers.add(p1.id);
      usedPlayers.add(p2.id);
    }
  }

  // Handle remaining unpaired players (those without unplayed matchups available)
  const remainingPlayers = selectedPlayers.filter((p) => !usedPlayers.has(p.id));

  // Pair remaining players together (even if they've played before)
  while (remainingPlayers.length >= 2) {
    const p1 = remainingPlayers.shift()!;
    const p2 = remainingPlayers.shift()!;
    recommendations.push({
      player1_id: p1.id,
      player2_id: p2.id,
      is_extra_match: false,
    });
  }

  // If odd number, give the remaining player a second match with someone else
  if (remainingPlayers.length === 1) {
    const oddPlayer = remainingPlayers[0];

    // Find a player they haven't played from the already-matched players
    const unplayedOpponent = selectedPlayers.find((p) => {
      if (p.id === oddPlayer.id) return false;
      const pairKey = [oddPlayer.id, p.id].sort().join("-");
      return !playedPairs.has(pairKey);
    });

    if (unplayedOpponent) {
      recommendations.push({
        player1_id: oddPlayer.id,
        player2_id: unplayedOpponent.id,
        is_extra_match: true,
      });
    } else {
      // All played, just pick someone else
      const opponent = selectedPlayers.find((p) => p.id !== oddPlayer.id);
      if (opponent) {
        recommendations.push({
          player1_id: oddPlayer.id,
          player2_id: opponent.id,
          is_extra_match: true,
        });
      }
    }
  }

  return recommendations;
}
