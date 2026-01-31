import {
  Link,
  useLoaderData,
  useOutletContext,
  useSearchParams,
} from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { AppUser, MatchWithPlayers } from "~/lib/types";
import type { Route } from "./+types/results";

export function meta() {
  return [
    { title: "Results | PD Table Tennis" },
    { name: "description", content: "Match results and results" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const phase = url.searchParams.get("phase") || "all";
  const playerId = url.searchParams.get("player") || "all";

  // Fetch all players for the filter dropdown
  const { data: players } = await supabase
    .from("players")
    .select("id, name")
    .order("name", { ascending: true });

  let query = supabase
    .from("matches")
    .select(
      `
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `,
    )
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (phase !== "all") {
    query = query.eq("phase", phase);
  }

  if (playerId !== "all") {
    query = query.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
  }

  const { data: matches } = await query;

  return {
    matches: (matches as MatchWithPlayers[]) || [],
    players: players || [],
  };
}

export default function Results() {
  const { matches, players } = useLoaderData<typeof loader>();
  const { user } = useOutletContext<{ user: AppUser | null }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status") || "all";
  const currentPhase = searchParams.get("phase") || "all";
  const currentPlayer = searchParams.get("player") || "all";

  const completedMatches = matches.filter((m) => m.status === "completed");
  const scheduledMatches = matches.filter((m) => m.status === "scheduled");

  const canEdit = user?.role === "admin" || user?.role === "editor";

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
    <main className="page">
      <div className="page-header">
        <h1>Results</h1>
        <p>
          {completedMatches.length} completed, {scheduledMatches.length}{" "}
          remaining
        </p>
      </div>

      {canEdit && (
        <div className="results-actions">
          <Link to="/editor/record-league" className="btn btn-primary">
            Submit Results
          </Link>
        </div>
      )}

      <div className="results-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={currentStatus}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="form-select"
          >
            <option value="all">All</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Phase:</label>
          <select
            value={currentPhase}
            onChange={(e) => updateFilter("phase", e.target.value)}
            className="form-select"
          >
            <option value="all">All</option>
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

      {matches.length === 0 ? (
        <p className="empty">No matches found.</p>
      ) : (
        <div className="results-list">
          {matches.map((match) => (
            <Link
              key={match.id}
              to={`/match/${match.id}`}
              className={`results-card ${match.status}`}
            >
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
                  {match.status === "completed" ? (
                    <span className="results-score">{getSetScore(match)}</span>
                  ) : (
                    <span>vs</span>
                  )}
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
              <div className="results-card-meta">
                <span className={`phase-badge ${match.phase}`}>
                  {formatPhase(match.phase)}
                </span>
                {match.status === "scheduled" && (
                  <span className="status-badge scheduled">Results</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
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
