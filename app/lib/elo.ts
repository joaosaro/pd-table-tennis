import type {
  EloRatingHistoryEntry,
  EloStanding,
  Match,
  Player,
  PlayerEloRating,
} from "./types";

const INITIAL_SEASON_ONE_RATING = 1000;
const MIN_VISIBLE_RATING = 600;

type EloMatchLike = Pick<
  Match,
  | "id"
  | "season"
  | "player1_id"
  | "player2_id"
  | "winner_id"
  | "recorded_at"
  | "created_at"
>;

interface PlayerState {
  player: Player;
  rating: number | null;
  initialRating: number | null;
  ratedGames: number;
  wins: number;
  losses: number;
  lastMatchId: string | null;
  lastPlayedAt: string | null;
}

interface EloHistoryDraft extends Omit<
  EloRatingHistoryEntry,
  "id" | "created_at"
> {}

interface EloDryRunPlayerChange {
  player: Player;
  score: number;
  expectedScore: number;
  kFactor: number;
  ratedGamesBefore: number;
  ratedGamesAfter: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
}

export interface EloDryRunMatch {
  matchId: string;
  season: number;
  playedAt: string;
  player1: EloDryRunPlayerChange;
  player2: EloDryRunPlayerChange;
  winnerId: string;
}

interface BuildEloRatingsResult {
  historyRows: EloHistoryDraft[];
  playerRatings: PlayerEloRating[];
  leaderboard: EloStanding[];
  dryRunMatches: EloDryRunMatch[];
}

export function calculateExpectedScore(rating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function getKFactor(ratedGamesBeforeMatch: number) {
  if (ratedGamesBeforeMatch <= 5) return 80;
  if (ratedGamesBeforeMatch <= 15) return 64;
  if (ratedGamesBeforeMatch <= 30) return 48;
  return 32;
}

export function getDisplayRating(rating: number) {
  return Math.max(MIN_VISIBLE_RATING, Math.round(rating));
}

export function buildEloRatings(
  players: Player[],
  matches: EloMatchLike[],
): BuildEloRatingsResult {
  const states = new Map<string, PlayerState>();
  const seasonOneParticipants = new Set<string>();

  for (const player of players) {
    states.set(player.id, {
      player,
      rating: null,
      initialRating: null,
      ratedGames: 0,
      wins: 0,
      losses: 0,
      lastMatchId: null,
      lastPlayedAt: null,
    });
  }

  const orderedMatches = getOrderedMatches(matches);

  for (const match of orderedMatches) {
    if (match.season === 1) {
      seasonOneParticipants.add(match.player1_id);
      seasonOneParticipants.add(match.player2_id);
    }
  }

  for (const playerId of seasonOneParticipants) {
    initializePlayer(states, playerId, INITIAL_SEASON_ONE_RATING);
  }

  const historyRows: EloHistoryDraft[] = [];
  const dryRunMatches: EloDryRunMatch[] = [];

  for (const match of orderedMatches) {
    const player1 = states.get(match.player1_id);
    const player2 = states.get(match.player2_id);

    if (!player1 || !player2 || !match.winner_id) {
      continue;
    }

    if (player1.rating === null) {
      initializePlayer(
        states,
        player1.player.id,
        getNewPlayerStartingRating(states),
      );
    }

    if (player2.rating === null) {
      initializePlayer(
        states,
        player2.player.id,
        getNewPlayerStartingRating(states),
      );
    }

    if (player1.rating === null || player2.rating === null) {
      continue;
    }

    const playedAt = match.recorded_at || match.created_at;
    const player1Score = match.winner_id === match.player1_id ? 1 : 0;
    const player2Score = match.winner_id === match.player2_id ? 1 : 0;
    const player1Expected = calculateExpectedScore(
      player1.rating,
      player2.rating,
    );
    const player2Expected = calculateExpectedScore(
      player2.rating,
      player1.rating,
    );
    const player1K = getKFactor(player1.ratedGames);
    const player2K = getKFactor(player2.ratedGames);
    const player1NextRating =
      player1.rating + player1K * (player1Score - player1Expected);
    const player2NextRating =
      player2.rating + player2K * (player2Score - player2Expected);

    historyRows.push({
      match_id: match.id,
      season: match.season,
      player_id: player1.player.id,
      opponent_id: player2.player.id,
      played_at: playedAt,
      result_score: player1Score,
      expected_score: player1Expected,
      k_factor: player1K,
      rated_games_before: player1.ratedGames,
      rated_games_after: player1.ratedGames + 1,
      rating_before: player1.rating,
      rating_after: player1NextRating,
      rating_change: player1NextRating - player1.rating,
    });

    historyRows.push({
      match_id: match.id,
      season: match.season,
      player_id: player2.player.id,
      opponent_id: player1.player.id,
      played_at: playedAt,
      result_score: player2Score,
      expected_score: player2Expected,
      k_factor: player2K,
      rated_games_before: player2.ratedGames,
      rated_games_after: player2.ratedGames + 1,
      rating_before: player2.rating,
      rating_after: player2NextRating,
      rating_change: player2NextRating - player2.rating,
    });

    dryRunMatches.push({
      matchId: match.id,
      season: match.season,
      playedAt,
      winnerId: match.winner_id,
      player1: {
        player: player1.player,
        score: player1Score,
        expectedScore: player1Expected,
        kFactor: player1K,
        ratedGamesBefore: player1.ratedGames,
        ratedGamesAfter: player1.ratedGames + 1,
        ratingBefore: player1.rating,
        ratingAfter: player1NextRating,
        ratingChange: player1NextRating - player1.rating,
      },
      player2: {
        player: player2.player,
        score: player2Score,
        expectedScore: player2Expected,
        kFactor: player2K,
        ratedGamesBefore: player2.ratedGames,
        ratedGamesAfter: player2.ratedGames + 1,
        ratingBefore: player2.rating,
        ratingAfter: player2NextRating,
        ratingChange: player2NextRating - player2.rating,
      },
    });

    player1.rating = player1NextRating;
    player2.rating = player2NextRating;
    player1.ratedGames += 1;
    player2.ratedGames += 1;
    player1.lastMatchId = match.id;
    player2.lastMatchId = match.id;
    player1.lastPlayedAt = playedAt;
    player2.lastPlayedAt = playedAt;

    if (player1Score === 1) {
      player1.wins += 1;
      player2.losses += 1;
    } else {
      player2.wins += 1;
      player1.losses += 1;
    }
  }

  for (const state of states.values()) {
    if (state.rating === null) {
      initializePlayer(
        states,
        state.player.id,
        getCurrentPoolStartingRating(states),
      );
    }
  }

  const playerRatings = Array.from(states.values()).map((state) => ({
    player_id: state.player.id,
    current_rating: state.rating ?? INITIAL_SEASON_ONE_RATING,
    initial_rating: state.initialRating ?? INITIAL_SEASON_ONE_RATING,
    rated_games: state.ratedGames,
    wins: state.wins,
    losses: state.losses,
    last_match_id: state.lastMatchId,
    last_played_at: state.lastPlayedAt,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const leaderboard = playerRatings
    .map((ratingRow) => {
      const state = states.get(ratingRow.player_id);
      if (!state) return null;

      return {
        player: state.player,
        ...ratingRow,
      };
    })
    .filter((row): row is { player: Player } & PlayerEloRating => row !== null);

  return {
    historyRows,
    playerRatings,
    leaderboard: buildLeaderboardFromStoredRatings(
      players,
      playerRatings,
      leaderboard.map((row) => row.player.id),
    ),
    dryRunMatches,
  };
}

export function buildLeaderboardFromStoredRatings(
  players: Player[],
  ratingRows: PlayerEloRating[],
  playerOrder?: string[],
) {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const preferredOrder = playerOrder
    ? new Map(playerOrder.map((playerId, index) => [playerId, index]))
    : null;

  return ratingRows
    .map((ratingRow) => {
      const player = playersById.get(ratingRow.player_id);
      if (!player) return null;

      return {
        player,
        rank: 0,
        rating: getDisplayRating(ratingRow.current_rating),
        rawRating: ratingRow.current_rating,
        initialRating: ratingRow.initial_rating,
        matchesPlayed: ratingRow.rated_games,
        wins: ratingRow.wins,
        losses: ratingRow.losses,
        lastPlayedAt: ratingRow.last_played_at,
      } satisfies EloStanding;
    })
    .filter((row): row is EloStanding => row !== null)
    .sort((a, b) => {
      if (b.rawRating !== a.rawRating) return b.rawRating - a.rawRating;
      if (b.matchesPlayed !== a.matchesPlayed) {
        return b.matchesPlayed - a.matchesPlayed;
      }

      if (preferredOrder) {
        const aOrder = preferredOrder.get(a.player.id);
        const bOrder = preferredOrder.get(b.player.id);
        if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) {
          return aOrder - bOrder;
        }
      }

      return a.player.name.localeCompare(b.player.name);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

function getOrderedMatches(matches: EloMatchLike[]) {
  return [...matches]
    .filter((match) => match.winner_id !== null)
    .sort((a, b) => {
      const aPlayedAt = new Date(a.recorded_at || a.created_at).getTime();
      const bPlayedAt = new Date(b.recorded_at || b.created_at).getTime();
      if (aPlayedAt !== bPlayedAt) return aPlayedAt - bPlayedAt;

      const createdDiff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (createdDiff !== 0) return createdDiff;

      return a.id.localeCompare(b.id);
    });
}

function initializePlayer(
  states: Map<string, PlayerState>,
  playerId: string,
  startingRating: number,
) {
  const state = states.get(playerId);
  if (!state || state.rating !== null) return;

  state.rating = startingRating;
  state.initialRating = startingRating;
}

function getNewPlayerStartingRating(states: Map<string, PlayerState>) {
  const activeRatings = Array.from(states.values())
    .filter((state) => !state.player.disabled)
    .map((state) => state.rating)
    .filter((rating): rating is number => rating !== null);

  if (activeRatings.length === 0) {
    return INITIAL_SEASON_ONE_RATING;
  }

  return Math.max(MIN_VISIBLE_RATING, Math.min(...activeRatings) - 100);
}

function getCurrentPoolStartingRating(states: Map<string, PlayerState>) {
  const activeRatings = Array.from(states.values())
    .filter((state) => !state.player.disabled)
    .map((state) => state.rating)
    .filter((rating): rating is number => rating !== null);

  if (activeRatings.length === 0) {
    return INITIAL_SEASON_ONE_RATING;
  }

  return Math.max(MIN_VISIBLE_RATING, Math.min(...activeRatings) - 100);
}
