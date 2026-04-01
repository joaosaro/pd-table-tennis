import { useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import {
  calculateStandings,
  deriveStandingsQualification,
} from "~/lib/tournament.server";
import type { MatchWithPlayers, Player } from "~/lib/types";
import type { Route } from "./+types/standings";

export function meta() {
  return [
    { title: "Standings | PD Table Tennis" },
    { name: "description", content: "League standings and rankings" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  // Get all players
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("name");

  // Get all completed league matches
  const { data: matches } = await supabase
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

  const standings = calculateStandings(
    (players as Player[]) || [],
    (matches as MatchWithPlayers[]) || [],
  );
  const qualification = deriveStandingsQualification(standings);

  // Get unique departments for filter
  const departments = [
    ...new Set(
      (players as Player[])
        ?.map((p) => p.department)
        .filter((d): d is string => d !== null),
    ),
  ].sort();

  return { standings, departments, qualification };
}

export default function Standings() {
  const { standings, departments, qualification } =
    useLoaderData<typeof loader>();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");

  const filteredStandings = useMemo(() => {
    if (!selectedDepartment) return standings;
    return standings.filter((s) => s.player.department === selectedDepartment);
  }, [standings, selectedDepartment]);

  return (
    <main className="page">
      <div className="page-header">
        <h1>League Standings</h1>
        <p>Top 10 qualify for playoffs. 1st and 2nd get byes to semifinals.</p>
      </div>

      {departments.length > 0 && (
        <div className="filter-bar">
          <label htmlFor="department-filter">Department:</label>
          <select
            id="department-filter"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="filter-select"
          >
            <option value="">All departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      )}

      {filteredStandings.length === 0 ? (
        <p className="empty">
          {standings.length === 0
            ? "No players registered yet."
            : "No players in this department."}
        </p>
      ) : (
        <div className="standings-table-container">
          <table className="data-table standings-table">
            <thead>
              <tr>
                <th className="text-center">#</th>
                <th>Player</th>
                <th className="text-center hide-mobile">Tier</th>
                <th className="text-center">P</th>
                <th className="text-center">W</th>
                <th className="text-center">L</th>
                <th className="text-right">Pts</th>
                <th className="text-center hide-mobile">Sets</th>
                <th className="text-center hide-mobile">Diff</th>
              </tr>
            </thead>
            <tbody>
              {filteredStandings.map((standing) => (
                <tr
                  key={standing.player.id}
                  className={getRowClass(standing.player.id, qualification)}
                >
                  <td className="text-center rank-cell">
                    <span
                      className={`rank-badge ${getRankClass(
                        standing.player.id,
                        qualification,
                      )}`}
                    >
                      {standing.rank}
                    </span>
                  </td>
                  <td>
                    <Link
                      to={`/player/${standing.player.id}`}
                      className={`player-link ${
                        standing.player.disqualified_from_qualification
                          ? "player-link-disqualified"
                          : ""
                      }`}
                    >
                      {standing.player.name}
                      {standing.player.disqualified_from_qualification && (
                        <sup className="standings-note-marker">
                          {getNoteNumber(standing.player.id, qualification)}
                        </sup>
                      )}
                    </Link>
                  </td>
                  <td className="text-center hide-mobile">
                    <span className={`tier-badge tier-${standing.player.tier}`}>
                      {standing.player.tier}
                    </span>
                  </td>
                  <td className="text-center">{standing.matchesPlayed}</td>
                  <td className="text-center">{standing.wins}</td>
                  <td className="text-center">{standing.losses}</td>
                  <td className="text-right points-cell">{standing.points}</td>
                  <td className="text-center hide-mobile">
                    {standing.setsWon}-{standing.setsLost}
                  </td>
                  <td className="text-center hide-mobile">
                    {standing.setDiff > 0
                      ? `+${standing.setDiff}`
                      : standing.setDiff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="standings-legend">
        <div className="legend-item">
          <span className="rank-badge rank-semifinal">1-2</span>
          <span>Direct to semifinals</span>
        </div>
        <div className="legend-item">
          <span className="rank-badge rank-knockout">3-10</span>
          <span>Knockout round</span>
        </div>
        <div className="legend-item">
          <span className="rank-badge">Remaining</span>
          <span>Eliminated</span>
        </div>
        <div className="legend-item">
          <span className="legend-disqualified-name">Disqualified</span>
          <span>Stats count, but qualification passes down</span>
        </div>
      </div>

      {qualification.noteEntries.length > 0 && (
        <section className="standings-notes">
          <h2>Disqualification notes</h2>
          <ol>
            {qualification.noteEntries.map((entry) => (
              <li key={entry.playerId}>
                <strong>{entry.playerName}</strong>: {entry.note}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="standings-tiebreak">
        <h2>Tie-break rules</h2>
        <ol>
          <li>Higher league points</li>
          <li>Head-to-head wins (only among tied players)</li>
          <li>More matches played</li>
          <li>Better set difference</li>
          <li>More total points scored (in sets)</li>
        </ol>
      </section>

      <section className="standings-tiebreak">
        <h2>How league points work (2025-based tiers)</h2>
        <p>
          This league uses weighted points. You do not get the same points for
          every win.
        </p>
        <p>
          When you win, your points depend on the tier of the opponent you beat.
          Tiers are based on 2025 results.
        </p>
        <ul>
          <li>Beat a Tier 1 player: 4 points</li>
          <li>Beat a Tier 2 player: 3 points</li>
          <li>Beat a Tier 3 player: 2 points</li>
          <li>Beat a Tier 4 player: 1 point</li>
        </ul>
        <p>
          If you lose, you get 0 points. This rewards wins against stronger
          opponents.
        </p>
      </section>

      <section className="standings-tiebreak standings-faq">
        <h2>FAQ (with examples)</h2>

        <div className="faq-item">
          <h3>Why can someone with fewer wins be above me?</h3>
          <p>
            Because points are weighted by opponent tier. Example: Player A has
            3 wins vs Tier 4 players (3 points total). Player B has 1 win vs a
            Tier 1 player (4 points total). Player B ranks higher.
          </p>
        </div>

        <div className="faq-item">
          <h3>Do I get points if I lose 2-1?</h3>
          <p>
            No. A loss always gives 0 league points, even in a close match. Set
            score still matters later for tie-breaks (set difference and points
            scored).
          </p>
        </div>

        <div className="faq-item">
          <h3>How does head-to-head work in a tie?</h3>
          <p>
            It only looks at results between tied players. Example: if Ana, Rui
            and Joao are tied on points, the system compares only matches among
            those three before moving to the next tie-break rule.
          </p>
        </div>

        <div className="faq-item">
          <h3>Can playing more matches help in ties?</h3>
          <p>
            Yes. After head-to-head, more matches played is the next rule.
            Example: two players tied on points and head-to-head, with 8 matches
            vs 7 matches played; the player with 8 is ranked higher.
          </p>
        </div>
      </section>
    </main>
  );
}

function getRowClass(
  playerId: string,
  qualification: Route.ComponentProps["loaderData"]["qualification"],
): string {
  if (qualification.semifinalPlayerIds.includes(playerId))
    return "row-semifinal";
  if (qualification.knockoutPlayerIds.includes(playerId)) return "row-knockout";
  return "";
}

function getRankClass(
  playerId: string,
  qualification: Route.ComponentProps["loaderData"]["qualification"],
): string {
  if (qualification.semifinalPlayerIds.includes(playerId)) {
    return "rank-semifinal";
  }
  if (qualification.knockoutPlayerIds.includes(playerId))
    return "rank-knockout";
  return "";
}

function getNoteNumber(
  playerId: string,
  qualification: Route.ComponentProps["loaderData"]["qualification"],
): number | null {
  return (
    qualification.noteEntries.find((entry) => entry.playerId === playerId)
      ?.number || null
  );
}
