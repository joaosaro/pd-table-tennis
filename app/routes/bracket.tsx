import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/bracket";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { calculateStandings } from "~/lib/tournament.server";
import type { Player, MatchWithPlayers, PlayerStanding } from "~/lib/types";

export function meta() {
  return [
    { title: "Bracket | PD Table Tennis" },
    { name: "description", content: "Knockout bracket" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  // Get all players
  const { data: players } = await supabase.from("players").select("*");

  // Get all league matches to calculate standings
  const { data: leagueMatches } = await supabase
    .from("matches")
    .select(`
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `)
    .eq("phase", "league")
    .eq("status", "completed");

  // Get knockout matches
  const { data: knockoutMatches } = await supabase
    .from("matches")
    .select(`
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `)
    .neq("phase", "league");

  const standings = calculateStandings(
    (players as Player[]) || [],
    (leagueMatches as MatchWithPlayers[]) || []
  );

  return {
    standings,
    knockoutMatches: (knockoutMatches as MatchWithPlayers[]) || [],
  };
}

export default function Bracket() {
  const { standings, knockoutMatches } = useLoaderData<typeof loader>();

  // Get qualified players (top 10)
  const qualified = standings.slice(0, 10);

  // Organize knockout matches by phase
  const round1 = knockoutMatches.filter((m) => m.phase === "knockout_r1");
  const round2 = knockoutMatches.filter((m) => m.phase === "knockout_r2");
  const semifinals = knockoutMatches.filter((m) => m.phase === "semifinal");
  const final = knockoutMatches.find((m) => m.phase === "final");

  if (qualified.length < 10) {
    return (
      <main className="page">
        <div className="page-header">
          <h1>Knockout Bracket</h1>
          <p>Bracket will be available after league phase completes.</p>
        </div>
        <div className="bracket-placeholder">
          <p>
            Need at least 10 players to qualify. Currently {qualified.length} have
            played league matches.
          </p>
          <Link to="/standings" className="btn btn-primary">
            View Standings
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>Knockout Bracket</h1>
        <p>Top 2 from league go directly to semifinals. 3rd-10th play knockout rounds.</p>
      </div>

      <div className="bracket-container">
        {/* Bye players */}
        <div className="bracket-section">
          <h3>Direct to Semifinals</h3>
          <div className="bye-players">
            {qualified.slice(0, 2).map((s) => (
              <Link
                key={s.player.id}
                to={`/player/${s.player.id}`}
                className="bye-player-card"
              >
                <span className="rank-badge rank-semifinal">{s.rank}</span>
                <span className="bye-player-name">{s.player.name}</span>
                <span className="bye-player-points">{s.points} pts</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Round 1 */}
        <div className="bracket-section">
          <h3>Round 1 (Knockout)</h3>
          <div className="bracket-round">
            {round1.length > 0 ? (
              round1.map((match) => (
                <BracketMatch key={match.id} match={match} />
              ))
            ) : (
              <div className="bracket-matchups">
                <BracketPreview seed1={3} seed2={10} qualified={qualified} />
                <BracketPreview seed1={4} seed2={9} qualified={qualified} />
                <BracketPreview seed1={5} seed2={8} qualified={qualified} />
                <BracketPreview seed1={6} seed2={7} qualified={qualified} />
              </div>
            )}
          </div>
        </div>

        {/* Round 2 */}
        <div className="bracket-section">
          <h3>Round 2</h3>
          <div className="bracket-round">
            {round2.length > 0 ? (
              round2.map((match) => (
                <BracketMatch key={match.id} match={match} />
              ))
            ) : (
              <div className="bracket-matchups">
                <div className="bracket-match-card pending">
                  <span>Winner of R1</span>
                  <span className="vs">vs</span>
                  <span>Winner of R1</span>
                </div>
                <div className="bracket-match-card pending">
                  <span>Winner of R1</span>
                  <span className="vs">vs</span>
                  <span>Winner of R1</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Semifinals */}
        <div className="bracket-section">
          <h3>Semifinals</h3>
          <div className="bracket-round">
            {semifinals.length > 0 ? (
              semifinals.map((match) => (
                <BracketMatch key={match.id} match={match} />
              ))
            ) : (
              <div className="bracket-matchups">
                <div className="bracket-match-card pending">
                  <span>1st Seed ({qualified[0]?.player.name})</span>
                  <span className="vs">vs</span>
                  <span>R2 Winner</span>
                </div>
                <div className="bracket-match-card pending">
                  <span>2nd Seed ({qualified[1]?.player.name})</span>
                  <span className="vs">vs</span>
                  <span>R2 Winner</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Final */}
        <div className="bracket-section">
          <h3>Final</h3>
          {final ? (
            <BracketMatch match={final} isFinal />
          ) : (
            <div className="bracket-match-card pending final">
              <span>Semifinal Winner</span>
              <span className="vs">vs</span>
              <span>Semifinal Winner</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function BracketMatch({
  match,
  isFinal,
}: {
  match: MatchWithPlayers;
  isFinal?: boolean;
}) {
  const p1Won = match.winner_id === match.player1_id;
  const p2Won = match.winner_id === match.player2_id;

  return (
    <Link
      to={`/match/${match.id}`}
      className={`bracket-match-card ${match.status} ${isFinal ? "final" : ""}`}
    >
      <div className={`bracket-player ${p1Won ? "winner" : ""}`}>
        <span className={`tier-badge tier-${match.player1.tier}`}>
          {match.player1.tier}
        </span>
        <span>{match.player1.name}</span>
        {match.status === "completed" && (
          <span className="bracket-sets">
            {countSetsWon(match, match.player1_id)}
          </span>
        )}
      </div>
      <div className={`bracket-player ${p2Won ? "winner" : ""}`}>
        <span className={`tier-badge tier-${match.player2.tier}`}>
          {match.player2.tier}
        </span>
        <span>{match.player2.name}</span>
        {match.status === "completed" && (
          <span className="bracket-sets">
            {countSetsWon(match, match.player2_id)}
          </span>
        )}
      </div>
    </Link>
  );
}

function BracketPreview({
  seed1,
  seed2,
  qualified,
}: {
  seed1: number;
  seed2: number;
  qualified: PlayerStanding[];
}) {
  const player1 = qualified[seed1 - 1];
  const player2 = qualified[seed2 - 1];

  return (
    <div className="bracket-match-card pending">
      <div className="bracket-player">
        <span className="rank-badge rank-knockout">{seed1}</span>
        <span>{player1?.player.name || "TBD"}</span>
      </div>
      <div className="bracket-player">
        <span className="rank-badge rank-knockout">{seed2}</span>
        <span>{player2?.player.name || "TBD"}</span>
      </div>
    </div>
  );
}

function countSetsWon(match: MatchWithPlayers, playerId: string): number {
  const isP1 = match.player1_id === playerId;
  let sets = 0;

  if (match.set1_p1 !== null && match.set1_p2 !== null) {
    if (isP1 && match.set1_p1 > match.set1_p2) sets++;
    if (!isP1 && match.set1_p2 > match.set1_p1) sets++;
  }
  if (match.set2_p1 !== null && match.set2_p2 !== null) {
    if (isP1 && match.set2_p1 > match.set2_p2) sets++;
    if (!isP1 && match.set2_p2 > match.set2_p1) sets++;
  }
  if (match.set3_p1 !== null && match.set3_p2 !== null) {
    if (isP1 && match.set3_p1 > match.set3_p2) sets++;
    if (!isP1 && match.set3_p2 > match.set3_p1) sets++;
  }

  return sets;
}
