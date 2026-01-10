import { Link, data, useLoaderData, useSearchParams } from "react-router";
import { requireRole } from "~/lib/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { MatchWithPlayers, Player } from "~/lib/types";
import type { Route } from "./+types/matches";

export function meta() {
  return [{ title: "Submit Results | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin", "editor"]);

  const { supabase } = createSupabaseServerClient(request);
  const url = new URL(request.url);
  const phase = url.searchParams.get("phase") || "all";
  const playerId = url.searchParams.get("player") || "all";

  // Fetch all players for the filter dropdown
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("name", { ascending: true });

  let query = supabase
    .from("matches")
    .select(
      `
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `
    )
    .order("phase")
    .order("created_at");

  if (phase !== "all") {
    query = query.eq("phase", phase);
  }

  if (playerId !== "all") {
    query = query.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
  }

  const { data: matches } = await query;

  // Calculate league progress
  const allPlayers = (players as Player[]) || [];
  const leagueMatches = (matches as MatchWithPlayers[])?.filter(
    (m) => m.phase === "league" && m.status === "completed"
  ) || [];

  const totalPossibleMatches = (allPlayers.length * (allPlayers.length - 1)) / 2;
  const completedLeagueMatches = leagueMatches.length;

  return data(
    {
      matches: (matches as MatchWithPlayers[]) || [],
      players: players || [],
      leagueProgress: {
        completed: completedLeagueMatches,
        total: totalPossibleMatches,
        remaining: totalPossibleMatches - completedLeagueMatches,
      },
    },
    { headers }
  );
}

export default function EditorMatches() {
  const { matches, players, leagueProgress } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentPhase = searchParams.get("phase") || "all";
  const currentPlayer = searchParams.get("player") || "all";

  const scheduledMatches = matches.filter((m) => m.status === "scheduled");
  const completedMatches = matches.filter((m) => m.status === "completed");

  function updateFilter(key: string, value: string) {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    setSearchParams(newParams);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Submit Results</h1>
        <p>Select a match to submit the result</p>
      </div>

      {leagueProgress.remaining > 0 && (
        <section className="admin-section league-record-section">
          <div className="league-progress-header">
            <div>
              <h2>League Progress</h2>
              <p className="league-progress-stats">
                {leagueProgress.completed} / {leagueProgress.total} matches
                completed ({leagueProgress.remaining} remaining)
              </p>
            </div>
            <Link to="/editor/record-league" className="btn btn-primary">
              Submit League Result
            </Link>
          </div>
        </section>
      )}

      <div className="results-filters">
        <div className="filter-group">
          <label>Phase:</label>
          <select
            value={currentPhase}
            onChange={(e) => updateFilter("phase", e.target.value)}
            className="form-select"
          >
            <option value="all">All Phases</option>
            <option value="league">League</option>
            <option value="knockout_r1">Knockout R1</option>
            <option value="knockout_r2">Knockout R2</option>
            <option value="semifinal">Semifinals</option>
            <option value="final">Final</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Player:</label>
          <select
            value={currentPlayer}
            onChange={(e) => updateFilter("player", e.target.value)}
            className="form-select"
          >
            <option value="all">All Players</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="admin-section">
        <h2>Scheduled Matches ({scheduledMatches.length})</h2>
        {scheduledMatches.length === 0 ? (
          <p className="empty">No scheduled matches.</p>
        ) : (
          <div className="results-list">
            {scheduledMatches.map((match) => (
              <div key={match.id} className="results-card scheduled">
                <div className="results-card-main">
                  <div className="results-player">
                    <span className={`tier-badge tier-${match.player1.tier}`}>
                      {match.player1.tier}
                    </span>
                    <span>{match.player1.name}</span>
                  </div>
                  <div className="results-vs">
                    <span>vs</span>
                  </div>
                  <div className="results-player">
                    <span>{match.player2.name}</span>
                    <span className={`tier-badge tier-${match.player2.tier}`}>
                      {match.player2.tier}
                    </span>
                  </div>
                </div>
                <div className="results-card-actions">
                  <span className={`phase-badge ${match.phase}`}>
                    {formatPhase(match.phase)}
                  </span>
                  <Link
                    to={`/editor/record/${match.id}`}
                    className="btn btn-primary"
                  >
                    Record Result
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>Completed Matches ({completedMatches.length})</h2>
        {completedMatches.length === 0 ? (
          <p className="empty">No completed matches.</p>
        ) : (
          <div className="results-list">
            {completedMatches.map((match) => (
              <div key={match.id} className="results-card completed">
                <div className="results-card-main">
                  <div className="results-player">
                    <span className={`tier-badge tier-${match.player1.tier}`}>
                      {match.player1.tier}
                    </span>
                    <span
                      className={
                        match.winner_id === match.player1_id ? "winner" : ""
                      }
                    >
                      {match.player1.name}
                    </span>
                  </div>
                  <div className="results-vs">
                    <span className="results-score">{getSetScore(match)}</span>
                  </div>
                  <div className="results-player">
                    <span
                      className={
                        match.winner_id === match.player2_id ? "winner" : ""
                      }
                    >
                      {match.player2.name}
                    </span>
                    <span className={`tier-badge tier-${match.player2.tier}`}>
                      {match.player2.tier}
                    </span>
                  </div>
                </div>
                <div className="results-card-actions">
                  <span className={`phase-badge ${match.phase}`}>
                    {formatPhase(match.phase)}
                  </span>
                  <Link
                    to={`/editor/record/${match.id}`}
                    className="btn btn-secondary"
                  >
                    Edit Result
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function getSetScore(match: MatchWithPlayers): string {
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

function formatPhase(phase: string): string {
  const phases: Record<string, string> = {
    league: "League",
    knockout_r1: "Knockout R1",
    knockout_r2: "Knockout R2",
    semifinal: "Semifinal",
    final: "Final",
  };
  return phases[phase] || phase;
}
