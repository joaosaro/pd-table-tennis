import type { EloMatch, EloStanding, Player } from "./types";

const DEFAULT_RATING = 1000;
const K_FACTOR = 32;

interface RatingState {
  player: Player;
  rating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  lastPlayedAt: string | null;
}

export function calculateEloStandings(
  players: Player[],
  matches: EloMatch[],
): EloStanding[] {
  const ratings = new Map<string, RatingState>();

  for (const player of players) {
    ratings.set(player.id, {
      player,
      rating: DEFAULT_RATING,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      lastPlayedAt: null,
    });
  }

  const orderedMatches = [...matches].sort((a, b) => {
    const playedDiff =
      new Date(a.played_at).getTime() - new Date(b.played_at).getTime();
    if (playedDiff !== 0) return playedDiff;

    const createdDiff =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (createdDiff !== 0) return createdDiff;

    return a.id.localeCompare(b.id);
  });

  for (const match of orderedMatches) {
    const p1 = ratings.get(match.player1_id);
    const p2 = ratings.get(match.player2_id);

    if (!p1 || !p2) continue;
    if (match.winner_id !== match.player1_id && match.winner_id !== match.player2_id) {
      continue;
    }

    const p1Score = match.winner_id === match.player1_id ? 1 : 0;
    const p2Score = 1 - p1Score;
    const p1Expected = getExpectedScore(p1.rating, p2.rating);
    const p2Expected = getExpectedScore(p2.rating, p1.rating);

    p1.rating += K_FACTOR * (p1Score - p1Expected);
    p2.rating += K_FACTOR * (p2Score - p2Expected);
    p1.matchesPlayed++;
    p2.matchesPlayed++;
    p1.lastPlayedAt = match.played_at;
    p2.lastPlayedAt = match.played_at;

    if (p1Score === 1) {
      p1.wins++;
      p2.losses++;
    } else {
      p2.wins++;
      p1.losses++;
    }
  }

  return Array.from(ratings.values())
    .map((standing) => ({
      player: standing.player,
      rank: 0,
      rating: Math.round(standing.rating),
      matchesPlayed: standing.matchesPlayed,
      wins: standing.wins,
      losses: standing.losses,
      lastPlayedAt: standing.lastPlayedAt,
    }))
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.matchesPlayed !== a.matchesPlayed) {
        return b.matchesPlayed - a.matchesPlayed;
      }
      return a.player.name.localeCompare(b.player.name);
    })
    .map((standing, index) => ({
      ...standing,
      rank: index + 1,
    }));
}

function getExpectedScore(rating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}
