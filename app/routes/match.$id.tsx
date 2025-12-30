import { Link, useLoaderData } from "react-router";
import { getUser } from "~/lib/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { MatchWithPlayers } from "~/lib/types";
import { TIER_POINTS } from "~/lib/types";
import type { Route } from "./+types/match.$id";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.match) {
    return [{ title: "Match | PD Table Tennis" }];
  }
  return [
    {
      title: `${data.match.player1.name} vs ${data.match.player2.name} | PD Table Tennis`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await getUser(request);
  const { supabase } = createSupabaseServerClient(request);

  const { data: match } = await supabase
    .from("matches")
    .select(
      `
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `
    )
    .eq("id", params.id)
    .single();

  if (!match) {
    throw new Response("Match not found", { status: 404 });
  }

  const canEdit = user?.role === "admin" || user?.role === "editor";

  return { match: match as MatchWithPlayers, canEdit };
}

export default function MatchDetails() {
  const { match, canEdit } = useLoaderData<typeof loader>();

  const sets = [
    { num: 1, p1: match.set1_p1, p2: match.set1_p2 },
    { num: 2, p1: match.set2_p1, p2: match.set2_p2 },
    { num: 3, p1: match.set3_p1, p2: match.set3_p2 },
  ].filter((s) => s.p1 !== null && s.p2 !== null);

  const p1SetsWon = sets.filter((s) => s.p1! > s.p2!).length;
  const p2SetsWon = sets.filter((s) => s.p2! > s.p1!).length;

  const winner =
    match.winner_id === match.player1_id ? match.player1 : match.player2;
  const loser =
    match.winner_id === match.player1_id ? match.player2 : match.player1;
  const pointsEarned =
    match.status === "completed" ? TIER_POINTS[loser.tier as 1 | 2 | 3 | 4] : 0;

  return (
    <main className="page">
      <div className="match-detail-card">
        <div className="match-phase-header">
          <span className={`phase-badge ${match.phase}`}>
            {formatPhase(match.phase)}
          </span>
          {match.status === "scheduled" && (
            <span className="status-badge scheduled">Scheduled</span>
          )}
          {canEdit && (
            <Link
              to={`/editor/record/${match.id}`}
              className="btn btn-primary"
            >
              {match.status === "scheduled" ? "Record Result" : "Edit Result"}
            </Link>
          )}
        </div>

        <div className="match-detail-players">
          <Link
            to={`/player/${match.player1.id}`}
            className={`match-player ${match.winner_id === match.player1_id ? "winner" : ""}`}
          >
            <div className="match-player-avatar">
              {match.player1.name.charAt(0).toUpperCase()}
            </div>
            <div className="match-player-info">
              <span className="match-player-name">{match.player1.name}</span>
              <span className="match-player-tier">
                <span className={`tier-badge tier-${match.player1.tier}`}>
                  {match.player1.tier}
                </span>
                {match.player1.department && ` • ${match.player1.department}`}
              </span>
            </div>
            {match.status === "completed" && (
              <span className="match-sets-won">{p1SetsWon}</span>
            )}
          </Link>

          <div className="match-vs-divider">
            {match.status === "completed" ? "Final" : "vs"}
          </div>

          <Link
            to={`/player/${match.player2.id}`}
            className={`match-player ${match.winner_id === match.player2_id ? "winner" : ""}`}
          >
            {match.status === "completed" && (
              <span className="match-sets-won">{p2SetsWon}</span>
            )}
            <div className="match-player-info right">
              <span className="match-player-name">{match.player2.name}</span>
              <span className="match-player-tier">
                {match.player2.department && `${match.player2.department} • `}
                <span className={`tier-badge tier-${match.player2.tier}`}>
                  {match.player2.tier}
                </span>
              </span>
            </div>
            <div className="match-player-avatar">
              {match.player2.name.charAt(0).toUpperCase()}
            </div>
          </Link>
        </div>

        {match.status === "completed" && sets.length > 0 && (
          <div className="match-sets">
            <h3>Set Scores</h3>
            <div className="sets-grid">
              {sets.map((set) => (
                <div key={set.num} className="set-box">
                  <span className="set-label">Set {set.num}</span>
                  <div className="set-scores">
                    <span className={set.p1! > set.p2! ? "set-winner" : ""}>
                      {set.p1}
                    </span>
                    <span className="set-separator">-</span>
                    <span className={set.p2! > set.p1! ? "set-winner" : ""}>
                      {set.p2}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {match.status === "completed" && (
          <div className="match-summary">
            <p>
              <strong>{winner.name}</strong> won and earned{" "}
              <strong>{pointsEarned} points</strong> (opponent tier {loser.tier}
              )
            </p>
          </div>
        )}

        {match.recorded_at && (
          <div className="match-recorded">
            Recorded {new Date(match.recorded_at).toLocaleDateString()}
          </div>
        )}
      </div>
    </main>
  );
}

function formatPhase(phase: string): string {
  const phases: Record<string, string> = {
    league: "League",
    knockout_r1: "Knockout Round 1",
    knockout_r2: "Knockout Round 2",
    semifinal: "Semifinal",
    final: "Final",
  };
  return phases[phase] || phase;
}
