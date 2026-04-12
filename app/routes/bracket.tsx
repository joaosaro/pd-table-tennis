import { Link, useLoaderData } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import {
  calculateStandings,
  deriveStandingsQualification,
} from "~/lib/tournament.server";
import type { MatchWithPlayers, Player, PlayerStanding } from "~/lib/types";
import type { Route } from "./+types/bracket";

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
    .select(
      `
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `,
    )
    .eq("phase", "league")
    .eq("status", "completed");

  // Check if league phase is still active (has incomplete matches)
  const { count: incompleteLeagueCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("phase", "league")
    .eq("status", "scheduled");

  // Get knockout matches
  const { data: knockoutMatches } = await supabase
    .from("matches")
    .select(
      `
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `,
    )
    .neq("phase", "league");

  const standings = calculateStandings(
    (players as Player[]) || [],
    (leagueMatches as MatchWithPlayers[]) || [],
  );
  const qualification = deriveStandingsQualification(standings);

  return {
    standings,
    qualification,
    knockoutMatches: (knockoutMatches as MatchWithPlayers[]) || [],
    leagueInProgress: (incompleteLeagueCount ?? 0) > 0,
  };
}

export default function Bracket() {
  const { standings, qualification, knockoutMatches, leagueInProgress } =
    useLoaderData<typeof loader>();

  // Get qualified players (top 10)
  const qualified = qualification.qualifiedPlayerIds
    .map((playerId) =>
      standings.find((standing) => standing.player.id === playerId),
    )
    .filter((standing): standing is PlayerStanding => Boolean(standing));

  // Organize knockout matches by phase
  const round1 = knockoutMatches.filter((m) => m.phase === "knockout_r1");
  const round2 = knockoutMatches.filter((m) => m.phase === "knockout_r2");
  const semifinals = knockoutMatches.filter((m) => m.phase === "semifinal");
  const final = knockoutMatches.find((m) => m.phase === "final");

  // Organize matches by bracket path using knockout_position
  const topBracketR1 = round1.filter(
    (m) => m.knockout_position === 1 || m.knockout_position === 2,
  );
  const bottomBracketR1 = round1.filter(
    (m) => m.knockout_position === 3 || m.knockout_position === 4,
  );
  const topBracketR2 = round2.find((m) => m.knockout_position === 1);
  const bottomBracketR2 = round2.find((m) => m.knockout_position === 2);
  const topSemifinal = semifinals.find((m) => m.knockout_position === 1);
  const bottomSemifinal = semifinals.find((m) => m.knockout_position === 2);
  const rankByPlayerId = new Map(
    standings.map((standing) => [standing.player.id, standing.rank]),
  );
  const matchByPosition = new Map(
    round1.map((match) => [match.knockout_position, match] as const),
  );
  const topR2KnownPlayer1 = getMatchWinner(matchByPosition.get(1));
  const topR2KnownPlayer2 = getMatchWinner(matchByPosition.get(2));
  const bottomR2KnownPlayer1 = getMatchWinner(matchByPosition.get(3));
  const bottomR2KnownPlayer2 = getMatchWinner(matchByPosition.get(4));
  const topSemifinalKnownWinner = getMatchWinner(topBracketR2);
  const bottomSemifinalKnownWinner = getMatchWinner(bottomBracketR2);
  const topFinalist = getMatchWinner(topSemifinal);
  const bottomFinalist = getMatchWinner(bottomSemifinal);

  return (
    <main className="page">
      <div className="page-header">
        <h1>Knockout Bracket</h1>
        <p>
          Top 2 from league go directly to semifinals. 3rd-10th play knockout
          rounds.
        </p>
      </div>

      {leagueInProgress && (
        <div className="provisional-banner">
          <strong>Provisional standings:</strong> League phase is still ongoing.
          Rankings may change as matches are completed.
        </div>
      )}

      <div className="bracket-dual">
        {/* Top Bracket */}
        <div className="bracket-half">
          <div className="bracket-half-header">
            <h3>Top Bracket</h3>
            <Link
              to={`/player/${qualified[0]?.player.id}`}
              className="bye-player-inline"
            >
              <span className="rank-badge rank-semifinal">1</span>
              <span>{qualified[0]?.player.name}</span>
              <span className="bye-label">→ Semi</span>
            </Link>
          </div>

          <div className="bracket-tree">
            {/* R1 */}
            <div className="bracket-column">
              <div className="bracket-column-label">Round 1</div>
              {topBracketR1.length > 0 ? (
                topBracketR1
                  .sort(
                    (a, b) =>
                      (a.knockout_position || 0) - (b.knockout_position || 0),
                  )
                  .map((match) => (
                    <BracketMatch
                      key={match.id}
                      match={match}
                      rankByPlayerId={rankByPlayerId}
                    />
                  ))
              ) : (
                <>
                  <BracketPreview seed1={4} seed2={9} qualified={qualified} />
                  <BracketPreview seed1={5} seed2={8} qualified={qualified} />
                </>
              )}
            </div>

            {/* R2 */}
            <div className="bracket-column">
              <div className="bracket-column-label">Round 2</div>
              {topBracketR2 ? (
                <BracketMatch
                  match={topBracketR2}
                  rankByPlayerId={rankByPlayerId}
                />
              ) : (
                <PendingMatchPreview
                  player1={topR2KnownPlayer1}
                  player1Label="Winner 4v9"
                  player2={topR2KnownPlayer2}
                  player2Label="Winner 5v8"
                  rankByPlayerId={rankByPlayerId}
                />
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bracket */}
        <div className="bracket-half">
          <div className="bracket-half-header">
            <h3>Bottom Bracket</h3>
            <Link
              to={`/player/${qualified[1]?.player.id}`}
              className="bye-player-inline"
            >
              <span className="rank-badge rank-semifinal">2</span>
              <span>{qualified[1]?.player.name}</span>
              <span className="bye-label">→ Semi</span>
            </Link>
          </div>

          <div className="bracket-tree">
            {/* R1 */}
            <div className="bracket-column">
              <div className="bracket-column-label">Round 1</div>
              {bottomBracketR1.length > 0 ? (
                bottomBracketR1
                  .sort(
                    (a, b) =>
                      (a.knockout_position || 0) - (b.knockout_position || 0),
                  )
                  .map((match) => (
                    <BracketMatch
                      key={match.id}
                      match={match}
                      rankByPlayerId={rankByPlayerId}
                    />
                  ))
              ) : (
                <>
                  <BracketPreview seed1={3} seed2={10} qualified={qualified} />
                  <BracketPreview seed1={6} seed2={7} qualified={qualified} />
                </>
              )}
            </div>

            {/* R2 */}
            <div className="bracket-column">
              <div className="bracket-column-label">Round 2</div>
              {bottomBracketR2 ? (
                <BracketMatch
                  match={bottomBracketR2}
                  rankByPlayerId={rankByPlayerId}
                />
              ) : (
                <PendingMatchPreview
                  player1={bottomR2KnownPlayer1}
                  player1Label="Winner 3v10"
                  player2={bottomR2KnownPlayer2}
                  player2Label="Winner 6v7"
                  rankByPlayerId={rankByPlayerId}
                />
              )}
            </div>
          </div>
        </div>

        {/* Finals Stage - Semifinals + Final */}
        <div className="bracket-finals-stage">
          <h3>Finals Stage</h3>

          <div className="bracket-finals-grid">
            {/* Semifinals */}
            <div className="bracket-semifinals">
              <div className="bracket-semi-match">
                <div className="bracket-semi-label">
                  Semifinal (Top Bracket)
                </div>
                {topSemifinal ? (
                  <BracketMatch
                    match={topSemifinal}
                    rankByPlayerId={rankByPlayerId}
                  />
                ) : (
                  <SemifinalPreview
                    byePlayer={qualified[0]}
                    byeSeed={1}
                    player2={topSemifinalKnownWinner}
                    r2WinnerLabel="Top R2 Winner"
                    rankByPlayerId={rankByPlayerId}
                  />
                )}
              </div>

              <div className="bracket-semi-match">
                <div className="bracket-semi-label">
                  Semifinal (Bottom Bracket)
                </div>
                {bottomSemifinal ? (
                  <BracketMatch
                    match={bottomSemifinal}
                    rankByPlayerId={rankByPlayerId}
                  />
                ) : (
                  <SemifinalPreview
                    byePlayer={qualified[1]}
                    byeSeed={2}
                    player2={bottomSemifinalKnownWinner}
                    r2WinnerLabel="Bottom R2 Winner"
                    rankByPlayerId={rankByPlayerId}
                  />
                )}
              </div>
            </div>

            {/* Final */}
            <div className="bracket-final-match">
              <div className="bracket-final-label">Final</div>
              {final ? (
                <BracketMatch
                  match={final}
                  isFinal
                  rankByPlayerId={rankByPlayerId}
                />
              ) : (
                <PendingMatchPreview
                  player1={topFinalist}
                  player1Label="Top Semi Winner"
                  player2={bottomFinalist}
                  player2Label="Bottom Semi Winner"
                  rankByPlayerId={rankByPlayerId}
                  isFinal
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function BracketMatch({
  match,
  isFinal,
  rankByPlayerId,
}: {
  match: MatchWithPlayers;
  isFinal?: boolean;
  rankByPlayerId: Map<string, number>;
}) {
  const p1Won = match.winner_id === match.player1_id;
  const p2Won = match.winner_id === match.player2_id;

  return (
    <Link
      to={`/match/${match.id}`}
      className={`bracket-match-card ${match.status} ${isFinal ? "final" : ""}`}
    >
      <div className={`bracket-player ${p1Won ? "winner" : ""}`}>
        <span className="rank-badge rank-knockout">
          {rankByPlayerId.get(match.player1_id) ?? "?"}
        </span>
        <span>{match.player1.name}</span>
        {match.status === "completed" && (
          <span className="bracket-sets">
            {countSetsWon(match, match.player1_id)}
          </span>
        )}
      </div>
      <div className={`bracket-player ${p2Won ? "winner" : ""}`}>
        <span className="rank-badge rank-knockout">
          {rankByPlayerId.get(match.player2_id) ?? "?"}
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

function PendingMatchPreview({
  player1,
  player1Label,
  player2,
  player2Label,
  rankByPlayerId,
  isFinal,
}: {
  player1?: Player | null;
  player1Label: string;
  player2?: Player | null;
  player2Label: string;
  rankByPlayerId: Map<string, number>;
  isFinal?: boolean;
}) {
  return (
    <div className={`bracket-match-card pending ${isFinal ? "final" : ""}`}>
      <PendingBracketPlayer
        player={player1}
        fallbackLabel={player1Label}
        rankByPlayerId={rankByPlayerId}
      />
      <PendingBracketPlayer
        player={player2}
        fallbackLabel={player2Label}
        rankByPlayerId={rankByPlayerId}
      />
    </div>
  );
}

function PendingBracketPlayer({
  player,
  fallbackLabel,
  rankByPlayerId,
}: {
  player?: Player | null;
  fallbackLabel: string;
  rankByPlayerId: Map<string, number>;
}) {
  return (
    <div className="bracket-player">
      <span className="rank-badge rank-knockout">
        {player ? rankByPlayerId.get(player.id) ?? "?" : "?"}
      </span>
      <span>{player?.name || fallbackLabel}</span>
    </div>
  );
}

function SemifinalPreview({
  byePlayer,
  byeSeed,
  player2,
  r2WinnerLabel,
  rankByPlayerId,
}: {
  byePlayer: PlayerStanding;
  byeSeed: number;
  player2?: Player | null;
  r2WinnerLabel: string;
  rankByPlayerId: Map<string, number>;
}) {
  return (
    <div className="bracket-match-card pending">
      <div className="bracket-player">
        <span className="rank-badge rank-semifinal">{byeSeed}</span>
        <span>{byePlayer?.player.name || "TBD"}</span>
      </div>
      <PendingBracketPlayer
        player={player2}
        fallbackLabel={r2WinnerLabel}
        rankByPlayerId={rankByPlayerId}
      />
    </div>
  );
}

function getMatchWinner(match?: MatchWithPlayers) {
  if (!match?.winner_id) return null;
  if (match.winner_id === match.player1_id) return match.player1;
  if (match.winner_id === match.player2_id) return match.player2;
  return null;
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
