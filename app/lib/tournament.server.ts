import type { Player, Match, MatchWithPlayers, PlayerStanding } from "./types";
import { TIER_POINTS } from "./types";

/**
 * Calculate league standings from players and matches.
 * Includes tiebreaker logic: Points → Head-to-head → Set diff → Points scored
 */
export function calculateStandings(
  players: Player[],
  matches: MatchWithPlayers[]
): PlayerStanding[] {
  // Initialize standings for all players
  const standingsMap = new Map<string, PlayerStanding>();

  for (const player of players) {
    standingsMap.set(player.id, {
      player,
      rank: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      points: 0,
      setsWon: 0,
      setsLost: 0,
      setDiff: 0,
      pointsScored: 0,
      pointsConceded: 0,
      pointDiff: 0,
    });
  }

  // Process only league matches that are completed
  const leagueMatches = matches.filter(
    (m) => m.phase === "league" && m.status === "completed"
  );

  // Build head-to-head map
  const headToHead = new Map<string, Map<string, number>>();

  for (const match of leagueMatches) {
    const p1Standing = standingsMap.get(match.player1_id);
    const p2Standing = standingsMap.get(match.player2_id);

    if (!p1Standing || !p2Standing) continue;

    // Update matches played
    p1Standing.matchesPlayed++;
    p2Standing.matchesPlayed++;

    // Calculate set scores
    const setScores = getSetScores(match);

    for (const [p1Score, p2Score] of setScores) {
      // Sets won/lost
      if (p1Score > p2Score) {
        p1Standing.setsWon++;
        p2Standing.setsLost++;
      } else {
        p2Standing.setsWon++;
        p1Standing.setsLost++;
      }

      // Points scored/conceded (within sets)
      p1Standing.pointsScored += p1Score;
      p1Standing.pointsConceded += p2Score;
      p2Standing.pointsScored += p2Score;
      p2Standing.pointsConceded += p1Score;
    }

    // Win/loss and tournament points
    const winnerId = match.winner_id;
    const loserId =
      winnerId === match.player1_id ? match.player2_id : match.player1_id;
    const loser = winnerId === match.player1_id ? match.player2 : match.player1;

    if (winnerId === match.player1_id) {
      p1Standing.wins++;
      p2Standing.losses++;
      p1Standing.points += TIER_POINTS[loser.tier as 1 | 2 | 3 | 4];
    } else {
      p2Standing.wins++;
      p1Standing.losses++;
      p2Standing.points += TIER_POINTS[loser.tier as 1 | 2 | 3 | 4];
    }

    // Update head-to-head
    if (!headToHead.has(winnerId!)) {
      headToHead.set(winnerId!, new Map());
    }
    const winnerH2H = headToHead.get(winnerId!)!;
    winnerH2H.set(loserId, (winnerH2H.get(loserId) || 0) + 1);
  }

  // Calculate diffs
  const standings = Array.from(standingsMap.values());
  for (const s of standings) {
    s.setDiff = s.setsWon - s.setsLost;
    s.pointDiff = s.pointsScored - s.pointsConceded;
  }

  // Sort standings with tiebreakers
  standings.sort((a, b) => {
    // 1. Points (descending)
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    // 2. Head-to-head
    const h2hResult = getHeadToHeadResult(a.player.id, b.player.id, headToHead);
    if (h2hResult !== 0) {
      return h2hResult;
    }

    // 3. Set difference (descending)
    if (b.setDiff !== a.setDiff) {
      return b.setDiff - a.setDiff;
    }

    // 4. Points scored (descending)
    return b.pointsScored - a.pointsScored;
  });

  // Assign ranks
  standings.forEach((s, i) => {
    s.rank = i + 1;
  });

  return standings;
}

/**
 * Get head-to-head comparison result.
 * Returns positive if player B wins, negative if player A wins, 0 if tied.
 */
function getHeadToHeadResult(
  playerAId: string,
  playerBId: string,
  headToHead: Map<string, Map<string, number>>
): number {
  const aWinsOverB = headToHead.get(playerAId)?.get(playerBId) || 0;
  const bWinsOverA = headToHead.get(playerBId)?.get(playerAId) || 0;

  return bWinsOverA - aWinsOverB;
}

/**
 * Extract set scores from a match.
 */
function getSetScores(match: Match): [number, number][] {
  const sets: [number, number][] = [];

  if (match.set1_p1 !== null && match.set1_p2 !== null) {
    sets.push([match.set1_p1, match.set1_p2]);
  }
  if (match.set2_p1 !== null && match.set2_p2 !== null) {
    sets.push([match.set2_p1, match.set2_p2]);
  }
  if (match.set3_p1 !== null && match.set3_p2 !== null) {
    sets.push([match.set3_p1, match.set3_p2]);
  }

  return sets;
}

/**
 * Generate all league matches (round-robin).
 * Each player plays every other player once.
 */
export function generateLeagueMatchPairs(
  players: Player[]
): [Player, Player][] {
  const pairs: [Player, Player][] = [];

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      pairs.push([players[i], players[j]]);
    }
  }

  return pairs;
}

/**
 * Generate knockout bracket from standings.
 * Top 2 get byes to semifinals.
 * 3rd-10th play first round: 3v10, 4v9, 5v8, 6v7.
 */
export function generateKnockoutMatchups(
  standings: PlayerStanding[]
): {
  round1: [PlayerStanding, PlayerStanding][];
  byePlayers: PlayerStanding[];
} {
  const qualified = standings.slice(0, 10);
  const byePlayers = qualified.slice(0, 2);

  // Round 1: 3v10, 4v9, 5v8, 6v7
  const round1: [PlayerStanding, PlayerStanding][] = [
    [qualified[2], qualified[9]], // 3rd vs 10th
    [qualified[3], qualified[8]], // 4th vs 9th
    [qualified[4], qualified[7]], // 5th vs 8th
    [qualified[5], qualified[6]], // 6th vs 7th
  ];

  return { round1, byePlayers };
}

/**
 * Generate round 2 matchups from round 1 winners.
 * Reseed by original league rank: best vs worst.
 */
export function generateRound2Matchups(
  round1Winners: PlayerStanding[]
): [PlayerStanding, PlayerStanding][] {
  // Sort winners by their original rank
  const sorted = [...round1Winners].sort((a, b) => a.rank - b.rank);

  // Best vs worst
  return [
    [sorted[0], sorted[3]], // Best remaining vs worst remaining
    [sorted[1], sorted[2]], // Second best vs third best
  ];
}
