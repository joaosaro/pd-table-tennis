import { Link, data, useLoaderData } from "react-router";
import { requireRole } from "~/lib/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { MatchWithPlayers } from "~/lib/types";
import type { Route } from "./+types/matches";

export function meta() {
  return [{ title: "Record Matches | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin", "editor"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: matches } = await supabase
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

  return data({ matches: (matches as MatchWithPlayers[]) || [] }, { headers });
}

export default function EditorMatches() {
  const { matches } = useLoaderData<typeof loader>();

  const scheduledMatches = matches.filter((m) => m.status === "scheduled");
  const completedMatches = matches.filter((m) => m.status === "completed");

  return (
    <div className="page">
      <div className="page-header">
        <h1>Record Matches</h1>
        <p>Select a match to record the result</p>
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
