import { Link, useLoaderData } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { MatchWithPlayers, TournamentSettings } from "~/lib/types";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "PD Table Tennis" },
    { name: "description", content: "Pipedrive Table Tennis Tournament" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  // Get tournament settings
  const { data: settings } = await supabase
    .from("tournament_settings")
    .select("*")
    .single();

  // Get player count
  const { count: playerCount } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true });

  // Get match stats
  const { count: totalMatches } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("phase", "league");

  const { count: completedMatches } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("phase", "league")
    .eq("status", "completed");

  // Get recent results (last 5 completed matches)
  const { data: recentMatches } = await supabase
    .from("matches")
    .select(
      `
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*),
      winner:players!matches_winner_id_fkey(*)
    `
    )
    .eq("status", "completed")
    .order("recorded_at", { ascending: false })
    .limit(5);

  return {
    settings: settings as TournamentSettings | null,
    playerCount: playerCount || 0,
    totalMatches: totalMatches || 0,
    completedMatches: completedMatches || 0,
    recentMatches: (recentMatches as MatchWithPlayers[]) || [],
  };
}

export default function Home() {
  const {
    settings,
    playerCount,
    totalMatches,
    completedMatches,
    recentMatches,
  } = useLoaderData<typeof loader>();

  const progress =
    totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;

  return (
    <main className="home-page">
      <section className="hero">
        <h1>{settings?.name || "PD Table Tennis"}</h1>
        <p className="hero-subtitle">Pipedrive Table Tennis Tournament</p>
        {settings?.league_deadline && (
          <p className="deadline">
            League deadline:{" "}
            {new Date(settings.league_deadline).toLocaleDateString()}
          </p>
        )}
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{playerCount}</span>
          <span className="stat-label">Players</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{completedMatches}</span>
          <span className="stat-label">Matches Played</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalMatches - completedMatches}</span>
          <span className="stat-label">Remaining</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{progress}%</span>
          <span className="stat-label">Progress</span>
        </div>
      </section>

      <section className="quick-links">
        <Link to="/standings" className="quick-link-card">
          <h3>Standings</h3>
          <p>View current league rankings</p>
        </Link>
        <Link to="/results" className="quick-link-card">
          <h3>Results</h3>
          <p>See all matches and results</p>
        </Link>
        <Link to="/bracket" className="quick-link-card">
          <h3>Bracket</h3>
          <p>View knockout bracket</p>
        </Link>
        <Link to="/players" className="quick-link-card">
          <h3>Players</h3>
          <p>Browse all participants</p>
        </Link>
      </section>

      {recentMatches.length > 0 && (
        <section className="recent-results">
          <h2>Recent Results</h2>
          <div className="results-list">
            {recentMatches.map((match) => (
              <Link
                to={`/match/${match.id}`}
                key={match.id}
                className="result-card"
              >
                <div className="result-players">
                  <span
                    className={
                      match.winner_id === match.player1_id ? "winner" : ""
                    }
                  >
                    {match.player1.name}
                  </span>
                  <span className="vs">vs</span>
                  <span
                    className={
                      match.winner_id === match.player2_id ? "winner" : ""
                    }
                  >
                    {match.player2.name}
                  </span>
                </div>
                <div className="result-score">{getMatchScore(match)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function getMatchScore(match: MatchWithPlayers): string {
  let p1Sets = 0;
  let p2Sets = 0;

  if (match.set1_p1 !== null && match.set1_p2 !== null) {
    if (match.set1_p1 > match.set1_p2) p1Sets++;
    else p2Sets++;
  }
  if (match.set2_p1 !== null && match.set2_p2 !== null) {
    if (match.set2_p1 > match.set2_p2) p1Sets++;
    else p2Sets++;
  }
  if (match.set3_p1 !== null && match.set3_p2 !== null) {
    if (match.set3_p1 > match.set3_p2) p1Sets++;
    else p2Sets++;
  }

  return `${p1Sets} - ${p2Sets}`;
}
