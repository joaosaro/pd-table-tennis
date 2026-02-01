export type PlayerSummary = {
  id: string;
  name: string;
  tier?: number | null;
};

export type MatchPairInput = {
  player1_id: string;
  player2_id: string;
};

export type Matchup = {
  player1: PlayerSummary;
  player2: PlayerSummary;
};

function getPairKey(player1Id: string, player2Id: string) {
  return [player1Id, player2Id].sort().join("-");
}

export function buildPlayedPairs(matches: MatchPairInput[]) {
  const pairs = new Set<string>();
  matches.forEach((match) => {
    pairs.add(getPairKey(match.player1_id, match.player2_id));
  });
  return pairs;
}

export function generateUnplayedLeagueMatchups(
  players: PlayerSummary[],
  completedMatches: MatchPairInput[]
) {
  const playedPairs = buildPlayedPairs(completedMatches);
  const matchups: Matchup[] = [];

  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const player1 = players[i];
      const player2 = players[j];
      const key = getPairKey(player1.id, player2.id);
      if (!playedPairs.has(key)) {
        matchups.push({ player1, player2 });
      }
    }
  }

  return matchups;
}
