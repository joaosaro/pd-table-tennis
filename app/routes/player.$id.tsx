import { Link, useLoaderData } from "react-router";
import { getDisplayRating } from "~/lib/elo";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type {
  EloRatingHistoryEntryWithPlayers,
  MatchWithPlayers,
  Player,
  PlayerEloRating,
} from "~/lib/types";
import { TIER_POINTS } from "~/lib/types";
import type { Route } from "./+types/player.$id";

export function meta({ data }: Route.MetaArgs) {
  const player = data?.player;
  return [
    {
      title: player
        ? `${player.name} | PD Table Tennis`
        : "Player | PD Table Tennis",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!player) {
    throw new Response("Player not found", { status: 404 });
  }

  // Get all matches for this player
  const { data: matches } = await supabase
    .from("edition_matches")
    .select(
      `
      *,
      player1:players!edition_matches_player1_id_fkey(*),
      player2:players!edition_matches_player2_id_fkey(*)
    `,
    )
    .or(`player1_id.eq.${params.id},player2_id.eq.${params.id}`)
    .eq("status", "completed")
    .order("recorded_at", { ascending: false });

  // Calculate stats
  const stats = calculatePlayerStats(
    player as Player,
    (matches as MatchWithPlayers[]) || [],
  );
  const { data: rating } = await supabase
    .from("player_elo_ratings")
    .select("*")
    .eq("player_id", params.id)
    .maybeSingle();

  const { data: eloHistory } = await supabase
    .from("elo_rating_history")
    .select(
      `
      *,
      opponent:players!elo_rating_history_opponent_id_fkey(*)
    `,
    )
    .eq("player_id", params.id)
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false });

  return {
    player: player as Player,
    matches: (matches as MatchWithPlayers[]) || [],
    stats,
    rating: rating as PlayerEloRating | null,
    eloHistory: (eloHistory as EloRatingHistoryEntryWithPlayers[]) || [],
  };
}

interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
}

function calculatePlayerStats(
  player: Player,
  matches: MatchWithPlayers[],
): PlayerStats {
  let wins = 0;
  let losses = 0;
  let points = 0;
  let setsWon = 0;
  let setsLost = 0;

  for (const match of matches) {
    const isPlayer1 = match.player1_id === player.id;
    const opponent = isPlayer1 ? match.player2 : match.player1;
    const won = match.winner_id === player.id;

    if (won) {
      wins++;
      // Only count points for league matches
      if (match.phase === "league") {
        points += TIER_POINTS[opponent.tier as 1 | 2 | 3 | 4];
      }
    } else {
      losses++;
    }

    // Calculate sets
    const sets = [
      [match.set1_p1, match.set1_p2],
      [match.set2_p1, match.set2_p2],
      [match.set3_p1, match.set3_p2],
    ];

    for (const [p1, p2] of sets) {
      if (p1 !== null && p2 !== null) {
        if (isPlayer1) {
          if (p1 > p2) setsWon++;
          else setsLost++;
        } else {
          if (p2 > p1) setsWon++;
          else setsLost++;
        }
      }
    }
  }

  return {
    matchesPlayed: matches.length,
    wins,
    losses,
    points,
    setsWon,
    setsLost,
    setDiff: setsWon - setsLost,
  };
}

export default function PlayerProfile() {
  const { player, matches, stats, rating, eloHistory } =
    useLoaderData<typeof loader>();

  return (
    <main className="page">
      <div className="player-profile-header">
        <div className="player-avatar-large">
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="player-profile-info">
          <h1>{player.name}</h1>
          <div className="player-meta">
            {player.department ? (
              <span>{player.department}</span>
            ) : (
              <span>No department</span>
            )}
          </div>
        </div>
      </div>

      <section className="player-stats-section">
        <h2>Statistics</h2>
        <div className="player-stats-grid">
          <div className="stat-card">
            <span className="stat-value">
              {rating ? getDisplayRating(rating.current_rating) : 1000}
            </span>
            <span className="stat-label">Current Elo</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.points}</span>
            <span className="stat-label">Points</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.wins}</span>
            <span className="stat-label">Wins</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.losses}</span>
            <span className="stat-label">Losses</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{rating?.rated_games ?? 0}</span>
            <span className="stat-label">Rated Matches</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.setsWon}</span>
            <span className="stat-label">Sets Won</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {stats.setDiff > 0 ? `+${stats.setDiff}` : stats.setDiff}
            </span>
            <span className="stat-label">Set Diff</span>
          </div>
        </div>
      </section>

      <section className="player-stats-section">
        <h2>Elo History</h2>
        {eloHistory.length === 0 ? (
          <p className="empty">No rated matches yet.</p>
        ) : (
          <div className="standings-table-container">
            <table className="data-table standings-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent</th>
                  <th className="text-center">Result</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">Elo</th>
                  <th className="text-center hide-mobile">K</th>
                </tr>
              </thead>
              <tbody>
                {eloHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.played_at).toLocaleDateString()}</td>
                    <td>{entry.opponent?.name || "-"}</td>
                    <td className="text-center">
                      {entry.result_score === 1 ? "W" : "L"}
                    </td>
                    <td className="text-right points-cell">
                      {entry.rating_change > 0
                        ? `+${Math.round(entry.rating_change)}`
                        : Math.round(entry.rating_change)}
                    </td>
                    <td className="text-right">
                      {getDisplayRating(entry.rating_after)}
                    </td>
                    <td className="text-center hide-mobile">
                      {entry.k_factor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="player-matches-section">
        <h2>Match History</h2>
        {matches.length === 0 ? (
          <p className="empty">No matches played yet.</p>
        ) : (
          <div className="match-history">
            {matches.map((match) => {
              const isPlayer1 = match.player1_id === player.id;
              const opponent = isPlayer1 ? match.player2 : match.player1;
              const won = match.winner_id === player.id;
              const score = getMatchScore(match, isPlayer1);

              return (
                <Link
                  key={match.id}
                  to={`/match/${match.id}`}
                  className={`match-history-card ${won ? "won" : "lost"}`}
                >
                  <div className="match-result-indicator">
                    {won ? "W" : "L"}
                  </div>
                  <div className="match-opponent">
                    <span className="opponent-name">{opponent.name}</span>
                  </div>
                  <div className="match-score">{score}</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function getMatchScore(match: MatchWithPlayers, isPlayer1: boolean): string {
  let mySets = 0;
  let oppSets = 0;

  const sets = [
    [match.set1_p1, match.set1_p2],
    [match.set2_p1, match.set2_p2],
    [match.set3_p1, match.set3_p2],
  ];

  for (const [p1, p2] of sets) {
    if (p1 !== null && p2 !== null) {
      if (isPlayer1) {
        if (p1 > p2) mySets++;
        else oppSets++;
      } else {
        if (p2 > p1) mySets++;
        else oppSets++;
      }
    }
  }

  return `${mySets} - ${oppSets}`;
}
