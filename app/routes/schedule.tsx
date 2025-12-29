import { Link, useLoaderData, useSearchParams } from "react-router";
import type { Route } from "./+types/schedule";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { MatchWithPlayers } from "~/lib/types";

export function meta() {
  return [
    { title: "Schedule | PD Table Tennis" },
    { name: "description", content: "Match schedule and results" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";
  const phase = url.searchParams.get("phase") || "all";

  let query = supabase
    .from("matches")
    .select(`
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `)
    .order("created_at", { ascending: true });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (phase !== "all") {
    query = query.eq("phase", phase);
  }

  const { data: matches } = await query;

  return { matches: (matches as MatchWithPlayers[]) || [] };
}

export default function Schedule() {
  const { matches } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status") || "all";
  const currentPhase = searchParams.get("phase") || "all";

  const completedMatches = matches.filter((m) => m.status === "completed");
  const scheduledMatches = matches.filter((m) => m.status === "scheduled");

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
        <h1>Schedule</h1>
        <p>
          {completedMatches.length} completed, {scheduledMatches.length} remaining
        </p>
      </div>

      <div className="schedule-filters">
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
      </div>

      {matches.length === 0 ? (
        <p className="empty">No matches found.</p>
      ) : (
        <div className="schedule-list">
          {matches.map((match) => (
            <Link
              key={match.id}
              to={`/match/${match.id}`}
              className={`schedule-card ${match.status}`}
            >
              <div className="schedule-card-main">
                <div className="schedule-player">
                  <span
                    className={`tier-badge tier-${match.player1.tier}`}
                  >
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
                <div className="schedule-vs">
                  {match.status === "completed" ? (
                    <span className="schedule-score">
                      {getSetScore(match)}
                    </span>
                  ) : (
                    <span>vs</span>
                  )}
                </div>
                <div className="schedule-player">
                  <span
                    className={
                      match.winner_id === match.player2_id ? "winner" : ""
                    }
                  >
                    {match.player2.name}
                  </span>
                  <span
                    className={`tier-badge tier-${match.player2.tier}`}
                  >
                    {match.player2.tier}
                  </span>
                </div>
              </div>
              <div className="schedule-card-meta">
                <span className={`phase-badge ${match.phase}`}>
                  {formatPhase(match.phase)}
                </span>
                {match.status === "scheduled" && (
                  <span className="status-badge scheduled">Scheduled</span>
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
