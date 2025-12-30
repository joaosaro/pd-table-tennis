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

/**
 * Knockout phase progression configuration
 */
interface KnockoutProgression {
  currentPhase: string;
  nextPhase: string;
  expectedMatches: number;
}

const KNOCKOUT_PROGRESSION: KnockoutProgression[] = [
  { currentPhase: "knockout_r1", nextPhase: "knockout_r2", expectedMatches: 4 },
  { currentPhase: "knockout_r2", nextPhase: "semifinal", expectedMatches: 2 },
  { currentPhase: "semifinal", nextPhase: "final", expectedMatches: 2 },
];

/**
 * Update or create next knockout round based on current results.
 * Returns operations to perform: deletes for stale matches, inserts for new/updated ones.
 * Uses delete+insert instead of update for consistency across all stages.
 */
export function getKnockoutRoundUpdates(
  allKnockoutMatches: Match[],
  standings: PlayerStanding[]
): {
  inserts: { player1_id: string; player2_id: string; phase: string; status: string; knockout_position?: number }[];
  deletes: string[]; // Match IDs to delete
} {
  const result: {
    inserts: { player1_id: string; player2_id: string; phase: string; status: string; knockout_position?: number }[];
    deletes: string[];
  } = { inserts: [], deletes: [] };

  for (const progression of KNOCKOUT_PROGRESSION) {
    const phaseMatches = allKnockoutMatches.filter(
      (m) => m.phase === progression.currentPhase
    );

    // Check if we have all expected matches and all are completed
    if (phaseMatches.length !== progression.expectedMatches) {
      continue;
    }

    const allCompleted = phaseMatches.every((m) => m.status === "completed");
    if (!allCompleted) {
      continue;
    }

    // Get winners from completed phase
    const winners = phaseMatches
      .map((m) => m.winner_id!)
      .filter((id) => id !== null);

    if (winners.length !== progression.expectedMatches) {
      continue;
    }

    // Generate the expected next round matchups
    const expectedMatchups = generateNextRoundMatchups(
      progression.nextPhase,
      winners,
      standings,
      allKnockoutMatches
    );

    if (!expectedMatchups) continue;

    // Check if next phase already exists
    const nextPhaseMatches = allKnockoutMatches.filter(
      (m) => m.phase === progression.nextPhase
    );

    // Get scheduled matches that might need to be replaced
    const scheduledMatches = nextPhaseMatches.filter(m => m.status === "scheduled");

    // Helper to check if a matchup already exists in nextPhaseMatches (scheduled OR completed)
    const matchupExists = (matchup: { player1_id: string; player2_id: string }) =>
      nextPhaseMatches.some(existing =>
        (existing.player1_id === matchup.player1_id && existing.player2_id === matchup.player2_id) ||
        (existing.player1_id === matchup.player2_id && existing.player2_id === matchup.player1_id)
      );

    // Find scheduled matches that don't match any expected matchup (stale matches)
    const staleScheduledMatches = scheduledMatches.filter(existing =>
      !expectedMatchups.some(expected =>
        (existing.player1_id === expected.player1_id && existing.player2_id === expected.player2_id) ||
        (existing.player1_id === expected.player2_id && existing.player2_id === expected.player1_id)
      )
    );

    // Find expected matchups that don't exist yet (need to be created)
    const missingMatchups = expectedMatchups.filter(expected => !matchupExists(expected));

    // Delete stale scheduled matches (wrong players due to edited results)
    if (staleScheduledMatches.length > 0) {
      result.deletes.push(...staleScheduledMatches.map(m => m.id));
    }

    // Insert missing matchups
    if (missingMatchups.length > 0) {
      result.inserts.push(...missingMatchups.map(m => ({
        player1_id: m.player1_id,
        player2_id: m.player2_id,
        phase: progression.nextPhase,
        status: "scheduled",
        knockout_position: m.knockout_position,
      })));
    }
  }

  return result;
}

/**
 * Generate matchups for a given knockout phase based on winners.
 * Uses fixed bracket paths: top bracket (pos 1,2) and bottom bracket (pos 3,4).
 */
function generateNextRoundMatchups(
  phase: string,
  winners: string[],
  standings: PlayerStanding[],
  allKnockoutMatches: Match[]
): { player1_id: string; player2_id: string; knockout_position?: number }[] | null {
  if (phase === "knockout_r2") {
    // Round 2: Fixed paths based on bracket position
    // Top bracket: pos 1 (3v10) winner vs pos 2 (4v9) winner
    // Bottom bracket: pos 3 (5v8) winner vs pos 4 (6v7) winner
    const r1Matches = allKnockoutMatches.filter((m) => m.phase === "knockout_r1");

    const pos1Match = r1Matches.find((m) => m.knockout_position === 1);
    const pos2Match = r1Matches.find((m) => m.knockout_position === 2);
    const pos3Match = r1Matches.find((m) => m.knockout_position === 3);
    const pos4Match = r1Matches.find((m) => m.knockout_position === 4);

    if (!pos1Match?.winner_id || !pos2Match?.winner_id || !pos3Match?.winner_id || !pos4Match?.winner_id) {
      return null;
    }

    return [
      { player1_id: pos1Match.winner_id, player2_id: pos2Match.winner_id, knockout_position: 1 }, // Top bracket R2
      { player1_id: pos3Match.winner_id, player2_id: pos4Match.winner_id, knockout_position: 2 }, // Bottom bracket R2
    ];
  }

  if (phase === "semifinal") {
    // Semifinals: Fixed paths
    // Semi 1: #1 seed vs top bracket R2 winner (pos 1)
    // Semi 2: #2 seed vs bottom bracket R2 winner (pos 2)
    const byePlayers = standings.slice(0, 2);
    const r2Matches = allKnockoutMatches.filter((m) => m.phase === "knockout_r2");

    const topBracketR2 = r2Matches.find((m) => m.knockout_position === 1);
    const bottomBracketR2 = r2Matches.find((m) => m.knockout_position === 2);

    if (!topBracketR2?.winner_id || !bottomBracketR2?.winner_id || byePlayers.length !== 2) {
      return null;
    }

    return [
      { player1_id: byePlayers[0].player.id, player2_id: topBracketR2.winner_id, knockout_position: 1 }, // #1 vs top bracket
      { player1_id: byePlayers[1].player.id, player2_id: bottomBracketR2.winner_id, knockout_position: 2 }, // #2 vs bottom bracket
    ];
  }

  if (phase === "final") {
    if (winners.length !== 2) return null;
    return [{ player1_id: winners[0], player2_id: winners[1] }];
  }

  return null;
}

/**
 * Check if all matches in a knockout phase are complete and generate next round.
 * Returns the matches to insert for the next round, or null if not ready.
 * @deprecated Use getKnockoutRoundUpdates instead
 */
export function getNextKnockoutRoundMatches(
  allKnockoutMatches: Match[],
  standings: PlayerStanding[]
): { phase: string; matches: { player1_id: string; player2_id: string; phase: string; status: string }[] } | null {
  for (const progression of KNOCKOUT_PROGRESSION) {
    const phaseMatches = allKnockoutMatches.filter(
      (m) => m.phase === progression.currentPhase
    );

    // Check if we have all expected matches and all are completed
    if (phaseMatches.length !== progression.expectedMatches) {
      continue;
    }

    const allCompleted = phaseMatches.every((m) => m.status === "completed");
    if (!allCompleted) {
      continue;
    }

    // Check if next phase already exists
    const nextPhaseExists = allKnockoutMatches.some(
      (m) => m.phase === progression.nextPhase
    );
    if (nextPhaseExists) {
      continue;
    }

    // Get winners from completed phase
    const winners = phaseMatches
      .map((m) => m.winner_id!)
      .filter((id) => id !== null);

    if (winners.length !== progression.expectedMatches) {
      continue;
    }

    // Generate next round matches based on phase
    if (progression.nextPhase === "knockout_r2") {
      // Round 2: Reseed winners by their original league rank
      const winnerStandings = winners
        .map((id) => standings.find((s) => s.player.id === id)!)
        .filter((s) => s !== undefined)
        .sort((a, b) => a.rank - b.rank);

      if (winnerStandings.length !== 4) continue;

      return {
        phase: "knockout_r2",
        matches: [
          {
            player1_id: winnerStandings[0].player.id, // Best seed
            player2_id: winnerStandings[3].player.id, // Worst seed
            phase: "knockout_r2",
            status: "scheduled",
          },
          {
            player1_id: winnerStandings[1].player.id, // 2nd best
            player2_id: winnerStandings[2].player.id, // 3rd best
            phase: "knockout_r2",
            status: "scheduled",
          },
        ],
      };
    }

    if (progression.nextPhase === "semifinal") {
      // Semifinals: 1st seed vs worse R2 winner, 2nd seed vs better R2 winner
      const byePlayers = standings.slice(0, 2); // 1st and 2nd from league
      const r2Winners = winners
        .map((id) => standings.find((s) => s.player.id === id)!)
        .filter((s) => s !== undefined)
        .sort((a, b) => a.rank - b.rank);

      if (r2Winners.length !== 2 || byePlayers.length !== 2) continue;

      return {
        phase: "semifinal",
        matches: [
          {
            player1_id: byePlayers[0].player.id, // 1st seed
            player2_id: r2Winners[1].player.id, // Worse R2 winner
            phase: "semifinal",
            status: "scheduled",
          },
          {
            player1_id: byePlayers[1].player.id, // 2nd seed
            player2_id: r2Winners[0].player.id, // Better R2 winner
            phase: "semifinal",
            status: "scheduled",
          },
        ],
      };
    }

    if (progression.nextPhase === "final") {
      // Final: Both semifinal winners
      return {
        phase: "final",
        matches: [
          {
            player1_id: winners[0],
            player2_id: winners[1],
            phase: "final",
            status: "scheduled",
          },
        ],
      };
    }
  }

  return null;
}
