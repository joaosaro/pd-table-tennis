import { Link, useLoaderData, useOutletContext } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { calculateStandings } from "~/lib/tournament.server";
import type {
  AppUser,
  MatchWithPlayers,
  Player,
  TournamentSettings,
} from "~/lib/types";
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

  // Get all players for standings
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("name");

  // Get all completed league matches for standings
  const { data: leagueMatches } = await supabase
    .from("matches")
    .select(
      `
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `
    )
    .eq("phase", "league")
    .eq("status", "completed");

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
    .limit(7);

  // Calculate standings
  const standings = calculateStandings(
    (players as Player[]) || [],
    (leagueMatches as MatchWithPlayers[]) || []
  );

  // Calculate unique players who have played at least one league match
  const playersWhoPlayed = new Set(
    (leagueMatches || []).flatMap((m) => [m.player1_id, m.player2_id])
  ).size;

  return {
    settings: settings as TournamentSettings | null,
    playerCount: (players || []).length,
    totalMatches: totalMatches || 0,
    completedMatches: completedMatches || 0,
    playersWhoPlayed,
    recentMatches: (recentMatches as MatchWithPlayers[]) || [],
    standings: standings.slice(0, 10), // Top 10 for minimal view
  };
}

export default function Home() {
  const {
    settings,
    playerCount,
    completedMatches,
    playersWhoPlayed,
    recentMatches,
    standings,
  } = useLoaderData<typeof loader>();
  const { user } = useOutletContext<{ user: AppUser | null }>();
  const canEdit = user?.role === "admin" || user?.role === "editor";

  return (
    <main className="home-page">
      <section className="hero">
        <h1>{settings?.name || "PD Table Tennis"}</h1>
        <p className="hero-subtitle">Pipedrive Table Tennis Tournament</p>
        <div className="hero-actions">
          <Link to="/recommendations?tab=custom" className="btn btn-primary">
            Try Match Finder
          </Link>
        </div>
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
          <span className="stat-value">{playersWhoPlayed}</span>
          <span className="stat-label">Players Active</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{completedMatches}</span>
          <span className="stat-label">Matches Played</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {Math.floor((playerCount * (playerCount - 1)) / 2) -
              completedMatches}
          </span>
          <span className="stat-label">Available to Play</span>
        </div>
      </section>

      <section className="home-columns">
        <div className="home-column">
          <div className="column-header">
            <h2>Standings</h2>
            <Link to="/standings" className="view-all-link">
              View all
            </Link>
          </div>
          {standings.length > 0 ? (
            <div className="mini-standings">
              {standings.map((standing) => (
                <Link
                  key={standing.player.id}
                  to={`/player/${standing.player.id}`}
                  className={`mini-standing-row ${getRankClass(standing.rank)}`}
                >
                  <span className="mini-rank">{standing.rank}</span>
                  <span className="mini-player-name">
                    {standing.player.name}
                  </span>
                  <span className="mini-points">{standing.points} pts</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty">No standings yet.</p>
          )}
        </div>

        <div className="home-column">
          <div className="column-header">
            <h2>Recent Results</h2>
            <Link to="/results" className="view-all-link">
              View all
            </Link>
          </div>
          {recentMatches.length > 0 ? (
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
          ) : (
            <p className="empty">No results yet.</p>
          )}
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
        <Link to="/recommendations" className="quick-link-card">
          <h3>Match Suggestions</h3>
          <p>This week&apos;s recommended matches</p>
        </Link>
        {canEdit && (
          <Link
            to="/editor/matches"
            className="quick-link-card quick-link-card--cta"
          >
            <h3>Submit Results</h3>
            <p>Record your match scores</p>
          </Link>
        )}
      </section>
    </main>
  );
}

function getRankClass(rank: number): string {
  if (rank <= 2) return "rank-semifinal";
  if (rank <= 10) return "rank-knockout";
  return "";
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
