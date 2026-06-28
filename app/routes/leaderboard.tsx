import { Link, useLoaderData } from "react-router";
import { buildLeaderboardFromStoredRatings } from "~/lib/elo";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Player, PlayerEloRating } from "~/lib/types";
import type { Route } from "./+types/leaderboard";

export function meta() {
  return [
    { title: "ELO Leaderboard | PD Table Tennis" },
    { name: "description", content: "Ongoing table tennis ELO leaderboard" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("disabled", false)
    .order("name");

  const { data: ratings } = await supabase
    .from("player_elo_ratings")
    .select("*");

  const leaderboard = buildLeaderboardFromStoredRatings(
    (players as Player[]) || [],
    (ratings as PlayerEloRating[]) || [],
  );

  return {
    leaderboard,
    matchCount:
      leaderboard.reduce((count, player) => count + player.matchesPlayed, 0) /
      2,
  };
}

export default function Leaderboard() {
  const { leaderboard, matchCount } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <div className="page-header">
        <h1>ELO Leaderboard</h1>
        <p>{matchCount} rated matches</p>
        <Link to="/elo" className="view-all-link">
          How it works
        </Link>
        <Link to="/elo/dry-run" className="view-all-link">
          Dry run
        </Link>
      </div>

      {leaderboard.length === 0 ? (
        <p className="empty">No players registered yet.</p>
      ) : (
        <div className="standings-table-container">
          <table className="data-table standings-table">
            <thead>
              <tr>
                <th className="text-center">#</th>
                <th>Player</th>
                <th className="text-right">Rating</th>
                <th className="text-center">P</th>
                <th className="text-center">W</th>
                <th className="text-center">L</th>
                <th className="text-center hide-mobile">Last Played</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((standing) => (
                <tr key={standing.player.id}>
                  <td className="text-center rank-cell">
                    <span className="rank-badge">{standing.rank}</span>
                  </td>
                  <td>
                    <Link
                      to={`/player/${standing.player.id}`}
                      className="player-link"
                    >
                      {standing.player.name}
                    </Link>
                  </td>
                  <td className="text-right points-cell">{standing.rating}</td>
                  <td className="text-center">{standing.matchesPlayed}</td>
                  <td className="text-center">{standing.wins}</td>
                  <td className="text-center">{standing.losses}</td>
                  <td className="text-center hide-mobile">
                    {standing.lastPlayedAt
                      ? new Date(standing.lastPlayedAt).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
