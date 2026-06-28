import { Link, useLoaderData, useOutletContext } from "react-router";
import { formatEditionLabel } from "~/lib/editions";
import {
  getActiveEdition,
  listArchivedEditionSummaries,
} from "~/lib/editions.server";
import { calculateEloStandings } from "~/lib/elo.server";
import { legacyArchiveEntries } from "~/lib/legacy-archive";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type {
  AppUser,
  EloMatchWithPlayers,
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
  const activeEdition = await getActiveEdition(supabase);

  // Get tournament settings
  const { data: settings } = await supabase
    .from("tournament_settings")
    .select("*")
    .single();

  // Get all players for the home page and ELO leaderboard
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("disabled", false)
    .order("name");

  // Get all completed league matches for standings
  const { data: leagueMatches } = await supabase
    .from("edition_matches")
    .select(
      `
      *,
      player1:players!edition_matches_player1_id_fkey(*),
      player2:players!edition_matches_player2_id_fkey(*)
    `,
    )
    .eq("edition_id", activeEdition?.id || "")
    .eq("phase", "league")
    .eq("status", "completed");

  const { count: completedMatches } = await supabase
    .from("edition_matches")
    .select("*", { count: "exact", head: true })
    .eq("edition_id", activeEdition?.id || "")
    .eq("phase", "league")
    .eq("status", "completed");

  const { count: remainingKnockoutMatches } = await supabase
    .from("edition_matches")
    .select("*", { count: "exact", head: true })
    .eq("edition_id", activeEdition?.id || "")
    .neq("phase", "league")
    .eq("status", "scheduled");

  // Get recent ELO results (last 5 completed matches by played date)
  const { data: recentMatches } = await supabase
    .from("elo_matches")
    .select(
      `
      *,
      player1:players!elo_matches_player1_id_fkey(*),
      player2:players!elo_matches_player2_id_fkey(*),
      winner:players!elo_matches_winner_id_fkey(*)
    `,
    )
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: eloMatches } = await supabase
    .from("elo_matches")
    .select(
      `
      *,
      player1:players!elo_matches_player1_id_fkey(*),
      player2:players!elo_matches_player2_id_fkey(*),
      winner:players!elo_matches_winner_id_fkey(*)
    `,
    )
    .order("played_at", { ascending: true })
    .order("created_at", { ascending: true });

  const leaderboard = calculateEloStandings(
    (players as Player[]) || [],
    (eloMatches as EloMatchWithPlayers[]) || [],
  );

  // Calculate unique players who have played at least one league match
  const playersWhoPlayed = new Set(
    (leagueMatches || []).flatMap((m) => [m.player1_id, m.player2_id]),
  ).size;
  const archivedEditions = await listArchivedEditionSummaries(supabase, 2);

  return {
    activeEdition,
    archivedEditions,
    settings: settings as TournamentSettings | null,
    playerCount: (players || []).length,
    completedMatches: completedMatches || 0,
    remainingKnockoutMatches: remainingKnockoutMatches || 0,
    playersWhoPlayed,
    recentMatches: (recentMatches as EloMatchWithPlayers[]) || [],
    leaderboard: leaderboard.slice(0, 8),
  };
}

export default function Home() {
  const {
    activeEdition,
    archivedEditions,
    settings,
    playerCount,
    completedMatches,
    remainingKnockoutMatches,
    playersWhoPlayed,
    recentMatches,
    leaderboard,
  } = useLoaderData<typeof loader>();
  const { user } = useOutletContext<{ user: AppUser | null }>();
  const canEdit = user?.role === "admin" || user?.role === "editor";
  const archivePreviewEntries = [...archivedEditions, ...legacyArchiveEntries];

  return (
    <main className="home-page">
      <section className="hero">
        <h1>{settings?.name || "PD Table Tennis"}</h1>
        <p className="hero-subtitle">Pipedrive Table Tennis Tournament</p>
        {activeEdition && (
          <p className="hero-subtitle hero-subtitle--secondary">
            {formatEditionLabel(activeEdition)}
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
          <span className="stat-value">{remainingKnockoutMatches}</span>
          <span className="stat-label">Remaining Matches</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{completedMatches}</span>
          <span className="stat-label">Matches Played</span>
        </div>
      </section>

      <section className="home-columns">
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
                  to={
                    match.source_match_id
                      ? `/match/${match.source_match_id}`
                      : "/results"
                  }
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

        <div className="home-column">
          <div className="column-header">
            <h2>Leaderboard ELO</h2>
            <Link to="/leaderboard" className="view-all-link">
              View all
            </Link>
          </div>
          {leaderboard.length > 0 ? (
            <div className="mini-standings">
              {leaderboard.map((standing) => (
                <Link
                  key={standing.player.id}
                  to={`/player/${standing.player.id}`}
                  className="mini-standing-row"
                >
                  <span className="mini-rank">{standing.rank}</span>
                  <span className="mini-player-name">
                    {standing.player.name}
                  </span>
                  <span className="mini-points">{standing.rating}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty">No rated matches yet.</p>
          )}
        </div>
      </section>

      <section className="quick-links">
        <Link to="/leaderboard" className="quick-link-card">
          <h3>Leaderboard</h3>
          <p>View ongoing ELO ratings</p>
        </Link>
        <Link to="/results" className="quick-link-card">
          <h3>Results</h3>
          <p>See all matches and results</p>
        </Link>
        <Link to="/archive" className="quick-link-card">
          <h3>Archive</h3>
          <p>Browse past standings, brackets, and champions</p>
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

      {archivePreviewEntries.length > 0 && (
        <section className="archive-preview">
          <div className="column-header">
            <h2>Previous Sessions</h2>
            <Link to="/archive" className="view-all-link">
              View archive
            </Link>
          </div>
          <div className="archive-grid">
            {archivedEditions.map((edition) => (
              <article key={edition.id} className="archive-card">
                <div className="archive-card-header">
                  <div>
                    <h3>{formatEditionLabel(edition)}</h3>
                    <p>{edition.name}</p>
                  </div>
                  {edition.champion && (
                    <span className="archive-champion-badge">Champion</span>
                  )}
                </div>
                <div className="archive-card-body">
                  <p className="archive-champion-name">
                    {edition.champion?.name || "Champion pending"}
                  </p>
                </div>
                <div className="archive-card-links">
                  <Link to={`/standings?edition=${edition.id}`}>Standings</Link>
                  <Link to={`/bracket?edition=${edition.id}`}>Bracket</Link>
                </div>
              </article>
            ))}
            {legacyArchiveEntries.map((edition) => (
              <article key={edition.id} className="archive-card">
                <div className="archive-card-header">
                  <div>
                    <h3>{formatEditionLabel(edition)}</h3>
                    <p>{edition.name}</p>
                  </div>
                  <span className="archive-champion-badge">Champion</span>
                </div>
                <div className="archive-card-body">
                  <p className="archive-champion-name">
                    {edition.championName}
                  </p>
                </div>
                <div className="archive-card-links">
                  {edition.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function getMatchScore(match: EloMatchWithPlayers): string {
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
