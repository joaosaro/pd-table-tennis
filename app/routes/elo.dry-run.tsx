import { Link, useLoaderData } from "react-router";
import {
  buildEloRatings,
  getDisplayRating,
  type EloDryRunMatch,
} from "~/lib/elo";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Match, Player } from "~/lib/types";
import type { Route } from "./+types/elo.dry-run";

export function meta() {
  return [
    { title: "Elo Dry Run | PD Table Tennis" },
    {
      name: "description",
      content: "Chronological Elo replay for every rated table tennis match.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  const [{ data: players }, { data: matches }] = await Promise.all([
    supabase.from("players").select("*").order("name"),
    supabase
      .from("edition_matches")
      .select("*")
      .eq("status", "completed")
      .not("winner_id", "is", null),
  ]);

  const dryRun = buildEloRatings(
    (players as Player[]) || [],
    (matches as Match[]) || [],
  );

  return {
    matches: dryRun.dryRunMatches,
    leaderboard: dryRun.leaderboard,
    playerCount: players?.length || 0,
  };
}

export default function EloDryRun() {
  const { matches, leaderboard, playerCount } = useLoaderData<typeof loader>();
  const latestMatch = matches.at(-1);

  return (
    <main className="page">
      <div className="page-header">
        <h1>Elo Dry Run</h1>
        <p>
          {matches.length} matches replayed across {playerCount} players
          {latestMatch
            ? ` through ${new Date(latestMatch.playedAt).toLocaleDateString()}`
            : ""}
          .
        </p>
        <div className="edition-context-links">
          <Link to="/elo">How Elo works</Link>
          <Link to="/leaderboard">Leaderboard</Link>
        </div>
      </div>

      <section className="dry-run-summary">
        {leaderboard.slice(0, 5).map((standing) => (
          <Link
            key={standing.player.id}
            to={`/player/${standing.player.id}`}
            className="dry-run-summary-item"
          >
            <span>{standing.rank}</span>
            <strong>{standing.player.name}</strong>
            <em>{standing.rating}</em>
          </Link>
        ))}
      </section>

      {matches.length === 0 ? (
        <p className="empty">No rated matches to replay.</p>
      ) : (
        <div className="standings-table-container dry-run-table-container">
          <table className="data-table standings-table dry-run-table">
            <thead>
              <tr>
                <th className="text-center">#</th>
                <th>Date</th>
                <th>Match</th>
                <th>Player</th>
                <th className="text-center">Result</th>
                <th className="text-right hide-mobile">Before</th>
                <th className="text-right hide-mobile">Exp</th>
                <th className="text-center hide-mobile">K</th>
                <th className="text-right">Change</th>
                <th className="text-right">After</th>
                <th className="text-center hide-mobile">Games</th>
              </tr>
            </thead>
            <tbody>
              {matches.flatMap((match, index) =>
                [match.player1, match.player2].map((entry, entryIndex) => (
                  <tr key={`${match.matchId}-${entry.player.id}`}>
                    {entryIndex === 0 ? (
                      <>
                        <td className="text-center" rowSpan={2}>
                          {index + 1}
                        </td>
                        <td rowSpan={2}>
                          {new Date(match.playedAt).toLocaleDateString()}
                        </td>
                        <td rowSpan={2}>
                          <Link to={`/match/${match.matchId}`}>
                            {match.player1.player.name} vs{" "}
                            {match.player2.player.name}
                          </Link>
                          <span className="dry-run-season">
                            Season {match.season}
                          </span>
                        </td>
                      </>
                    ) : null}
                    <td>
                      <Link
                        to={`/player/${entry.player.id}`}
                        className={
                          entry.player.id === match.winnerId
                            ? "player-link winner"
                            : "player-link"
                        }
                      >
                        {entry.player.name}
                      </Link>
                    </td>
                    <td className="text-center">
                      {entry.score === 1 ? "W" : entry.score === 0 ? "L" : "D"}
                    </td>
                    <td className="text-right hide-mobile">
                      {formatDecimal(entry.ratingBefore)}
                    </td>
                    <td className="text-right hide-mobile">
                      {formatDecimal(entry.expectedScore, 3)}
                    </td>
                    <td className="text-center hide-mobile">{entry.kFactor}</td>
                    <td className="text-right points-cell">
                      {formatChange(entry.ratingChange)}
                    </td>
                    <td className="text-right">
                      {getDisplayRating(entry.ratingAfter)}
                    </td>
                    <td className="text-center hide-mobile">
                      {entry.ratedGamesBefore} {"->"} {entry.ratedGamesAfter}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function formatChange(value: number) {
  const rounded = formatDecimal(value);
  return value > 0 ? `+${rounded}` : rounded;
}

function formatDecimal(value: number, digits = 1) {
  return value.toFixed(digits);
}
