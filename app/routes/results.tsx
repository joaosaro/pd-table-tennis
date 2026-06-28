import {
  Link,
  useLoaderData,
  useOutletContext,
  useSearchParams,
} from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type {
  AppUser,
  EloMatchWithPlayers,
  MatchWithPlayers,
} from "~/lib/types";
import type { Route } from "./+types/results";

type ResultItem = {
  id: string;
  href: string | null;
  status: "completed" | "scheduled";
  phase: string | null;
  playedAt: string | null;
  createdAt: string;
  player1: MatchWithPlayers["player1"];
  player2: MatchWithPlayers["player2"];
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  set1_p1: number | null;
  set1_p2: number | null;
  set2_p1: number | null;
  set2_p2: number | null;
  set3_p1: number | null;
  set3_p2: number | null;
};

type EloResultMatch = EloMatchWithPlayers & {
  source_match?: { id: string; phase: string } | null;
};

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

  const shouldLoadCompleted = status === "all" || status === "completed";
  const shouldLoadScheduled = status === "all" || status === "scheduled";

  let completedQuery = supabase
    .from("elo_matches")
    .select(
      `
      *,
      player1:players!elo_matches_player1_id_fkey(*),
      player2:players!elo_matches_player2_id_fkey(*),
      source_match:edition_matches!elo_matches_source_match_id_fkey(id, phase)
    `,
    )
    .order("played_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (playerId !== "all") {
    completedQuery = completedQuery.or(
      `player1_id.eq.${playerId},player2_id.eq.${playerId}`,
    );
  }

  let scheduledQuery = supabase
    .from("edition_matches")
    .select(
      `
      *,
      player1:players!edition_matches_player1_id_fkey(*),
      player2:players!edition_matches_player2_id_fkey(*)
    `,
    )
    .eq("status", "scheduled")
    .order("created_at", { ascending: false });

  if (phase !== "all") {
    scheduledQuery = scheduledQuery.eq("phase", phase);
  }

  if (playerId !== "all") {
    scheduledQuery = scheduledQuery.or(
      `player1_id.eq.${playerId},player2_id.eq.${playerId}`,
    );
  }

  const [{ data: completedMatches }, { data: scheduledMatches }] =
    await Promise.all([
      shouldLoadCompleted ? completedQuery : Promise.resolve({ data: [] }),
      shouldLoadScheduled ? scheduledQuery : Promise.resolve({ data: [] }),
    ]);

  const completedResults = ((completedMatches as EloResultMatch[]) || [])
    .filter((match) => phase === "all" || match.source_match?.phase === phase)
    .map<ResultItem>((match) => ({
      id: match.id,
      href: match.source_match_id ? `/match/${match.source_match_id}` : null,
      status: "completed",
      phase: match.source_match?.phase || null,
      playedAt: match.played_at,
      createdAt: match.created_at,
      player1: match.player1,
      player2: match.player2,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      winner_id: match.winner_id,
      set1_p1: match.set1_p1,
      set1_p2: match.set1_p2,
      set2_p1: match.set2_p1,
      set2_p2: match.set2_p2,
      set3_p1: match.set3_p1,
      set3_p2: match.set3_p2,
    }));

  const scheduledResults = (
    (scheduledMatches as MatchWithPlayers[]) || []
  ).map<ResultItem>((match) => ({
    id: match.id,
    href: `/match/${match.id}`,
    status: "scheduled",
    phase: match.phase,
    playedAt: null,
    createdAt: match.created_at,
    player1: match.player1,
    player2: match.player2,
    player1_id: match.player1_id,
    player2_id: match.player2_id,
    winner_id: match.winner_id,
    set1_p1: match.set1_p1,
    set1_p2: match.set1_p2,
    set2_p1: match.set2_p1,
    set2_p2: match.set2_p2,
    set3_p1: match.set3_p1,
    set3_p2: match.set3_p2,
  }));

  const results = [...completedResults, ...scheduledResults].sort((a, b) => {
    const aDate = a.playedAt || a.createdAt;
    const bDate = b.playedAt || b.createdAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return {
    results,
    completedCount: completedResults.length,
    scheduledCount: scheduledResults.length,
    players: players || [],
  };
}

export default function Results() {
  const { results, completedCount, scheduledCount, players } =
    useLoaderData<typeof loader>();
  const { user } = useOutletContext<{ user: AppUser | null }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentStatus = searchParams.get("status") || "all";
  const currentPhase = searchParams.get("phase") || "all";
  const currentPlayer = searchParams.get("player") || "all";

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
          {completedCount} completed, {scheduledCount} remaining
        </p>
      </div>

      {canEdit && (
        <div className="results-actions">
          <Link to="/editor/matches" className="btn btn-primary">
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

      {results.length === 0 ? (
        <p className="empty">No matches found.</p>
      ) : (
        <div className="results-list">
          {results.map((match) => (
            <ResultCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </main>
  );
}

function ResultCard({ match }: { match: ResultItem }) {
  const content = (
    <>
      <div className="results-card-main">
        <div className="results-player">
          <span className={`tier-badge tier-${match.player1.tier}`}>
            {match.player1.tier}
          </span>
          <span
            className={match.winner_id === match.player1_id ? "winner" : ""}
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
            className={match.winner_id === match.player2_id ? "winner" : ""}
          >
            {match.player2.name}
          </span>
          <span className={`tier-badge tier-${match.player2.tier}`}>
            {match.player2.tier}
          </span>
        </div>
      </div>
      <div className="results-card-meta">
        {match.phase ? (
          <span className={`phase-badge ${match.phase}`}>
            {formatPhase(match.phase)}
          </span>
        ) : (
          <span className="phase-badge">Past Match</span>
        )}
        <span className="results-date">
          {formatMatchDate(match.playedAt || match.createdAt)}
        </span>
        {match.status === "scheduled" && (
          <span className="status-badge scheduled">Results</span>
        )}
      </div>
    </>
  );

  if (match.href) {
    return (
      <Link to={match.href} className={`results-card ${match.status}`}>
        {content}
      </Link>
    );
  }

  return <div className={`results-card ${match.status}`}>{content}</div>;
}

function getSetScore(match: ResultItem): string {
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

function formatMatchDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
