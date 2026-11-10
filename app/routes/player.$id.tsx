import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/player.$id";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Player, Match, MatchWithPlayers } from "~/lib/types";
import { TIER_POINTS } from "~/lib/types";

export function meta({ data }: Route.MetaArgs) {
  const player = data?.player;
  return [
    { title: player ? `${player.name} | PD Table Tennis` : "Player | PD Table Tennis" },
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
    .from("matches")
    .select(`
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `)
    .or(`player1_id.eq.${params.id},player2_id.eq.${params.id}`)
    .eq("status", "completed")
    .order("recorded_at", { ascending: false });

  // Calculate stats
  const stats = calculatePlayerStats(player as Player, (matches as MatchWithPlayers[]) || []);

  return {
    player: player as Player,
    matches: (matches as MatchWithPlayers[]) || [],
    stats
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

function calculatePlayerStats(player: Player, matches: MatchWithPlayers[]): PlayerStats {
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
        points += TIER_POINTS[opponent.tier as 1|2|3|4];
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
  const { player, matches, stats } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <div className="player-profile-header">
        <div className="player-avatar-large">
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="player-profile-info">
          <h1>{player.name}</h1>
          <div className="player-meta">
            <span className={`tier-badge tier-${player.tier}`}>{player.tier}</span>
            <span>Tier {player.tier}</span>
            {player.department && <span>• {player.department}</span>}
          </div>
        </div>
      </div>

      <section className="player-stats-section">
        <h2>Statistics</h2>
        <div className="player-stats-grid">
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
            <span className="stat-value">{stats.matchesPlayed}</span>
            <span className="stat-label">Matches</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.setsWon}</span>
            <span className="stat-label">Sets Won</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.setDiff > 0 ? `+${stats.setDiff}` : stats.setDiff}</span>
            <span className="stat-label">Set Diff</span>
          </div>
        </div>
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
                    <span className={`tier-badge tier-${opponent.tier}`}>
                      {opponent.tier}
                    </span>
                  </div>
                  <div className="match-score">{score}</div>
                  {won && match.phase === "league" && (
                    <div className="match-points">
                      +{TIER_POINTS[opponent.tier as 1|2|3|4]} pts
                    </div>
                  )}
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
