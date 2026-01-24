import type { Player } from "./types";

export interface RecommendedMatch {
  player1_id: string;
  player2_id: string;
  is_extra_match: boolean;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate weekly match recommendations.
 * Randomly pairs selected players.
 * If odd number, one player gets a second match.
 */
export function generateRecommendations(selectedPlayers: Player[]): RecommendedMatch[] {
  if (selectedPlayers.length < 2) {
    return [];
  }

  // Shuffle players randomly
  const shuffledPlayers = shuffleArray(selectedPlayers);
  const recommendations: RecommendedMatch[] = [];

  // Pair players sequentially after shuffling
  for (let i = 0; i < shuffledPlayers.length - 1; i += 2) {
    recommendations.push({
      player1_id: shuffledPlayers[i].id,
      player2_id: shuffledPlayers[i + 1].id,
      is_extra_match: false,
    });
  }

  // If odd number, give the last player a second match with a random opponent
  if (shuffledPlayers.length % 2 === 1) {
    const oddPlayer = shuffledPlayers[shuffledPlayers.length - 1];
    // Pick a random opponent from the already-matched players
    const randomOpponent = shuffledPlayers[Math.floor(Math.random() * (shuffledPlayers.length - 1))];
    recommendations.push({
      player1_id: oddPlayer.id,
      player2_id: randomOpponent.id,
      is_extra_match: true,
    });
  }

  return recommendations;
}
