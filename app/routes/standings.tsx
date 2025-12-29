import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/standings";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { calculateStandings } from "~/lib/tournament.server";
import type { Player, MatchWithPlayers, PlayerStanding } from "~/lib/types";

export function meta() {
  return [
    { title: "Standings | PD Table Tennis" },
    { name: "description", content: "League standings and rankings" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  // Get all players
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("name");

  // Get all completed league matches
  const { data: matches } = await supabase
    .from("matches")
    .select(`
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `)
    .eq("phase", "league")
    .eq("status", "completed");

  const standings = calculateStandings(
    (players as Player[]) || [],
    (matches as MatchWithPlayers[]) || []
  );

  return { standings };
}

export default function Standings() {
  const { standings } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <div className="page-header">
        <h1>League Standings</h1>
        <p>Top 10 qualify for playoffs. 1st and 2nd get byes to semifinals.</p>
      </div>

      {standings.length === 0 ? (
        <p className="empty">No players registered yet.</p>
      ) : (
        <div className="standings-table-container">
          <table className="data-table standings-table">
            <thead>
              <tr>
                <th className="text-center">#</th>
                <th>Player</th>
                <th className="text-center">Tier</th>
                <th className="text-center">P</th>
                <th className="text-center">W</th>
                <th className="text-center">L</th>
                <th className="text-right">Pts</th>
                <th className="text-center hide-mobile">Sets</th>
                <th className="text-center hide-mobile">Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((standing) => (
                <tr
                  key={standing.player.id}
                  className={getRowClass(standing.rank)}
                >
                  <td className="text-center rank-cell">
                    <span className={`rank-badge ${getRankClass(standing.rank)}`}>
                      {standing.rank}
                    </span>
                  </td>
                  <td>
                    <Link
                      to={`/player/${standing.player.id}`}
                      className="player-link"
                    >
                      {standing.player.name}
                    </Link>
                  </td>
                  <td className="text-center">
                    <span className={`tier-badge tier-${standing.player.tier}`}>
                      {standing.player.tier}
                    </span>
                  </td>
                  <td className="text-center">{standing.matchesPlayed}</td>
                  <td className="text-center">{standing.wins}</td>
                  <td className="text-center">{standing.losses}</td>
                  <td className="text-right points-cell">{standing.points}</td>
                  <td className="text-center hide-mobile">
                    {standing.setsWon}-{standing.setsLost}
                  </td>
                  <td className="text-center hide-mobile">
                    {standing.setDiff > 0 ? `+${standing.setDiff}` : standing.setDiff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="standings-legend">
        <div className="legend-item">
          <span className="rank-badge rank-semifinal">1-2</span>
          <span>Direct to semifinals</span>
        </div>
        <div className="legend-item">
          <span className="rank-badge rank-knockout">3-10</span>
          <span>Knockout round</span>
        </div>
        <div className="legend-item">
          <span className="rank-badge">11+</span>
          <span>Eliminated</span>
        </div>
      </div>
    </main>
  );
}

function getRowClass(rank: number): string {
  if (rank <= 2) return "row-semifinal";
  if (rank <= 10) return "row-knockout";
  return "";
}

function getRankClass(rank: number): string {
  if (rank <= 2) return "rank-semifinal";
  if (rank <= 10) return "rank-knockout";
  return "";
}
