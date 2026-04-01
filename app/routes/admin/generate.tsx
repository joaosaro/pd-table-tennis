import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { requireRole } from "~/lib/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import {
  calculateStandings,
  deriveStandingsQualification,
} from "~/lib/tournament.server";
import type { MatchWithPlayers, Player, PlayerStanding } from "~/lib/types";
import type { Route } from "./+types/generate";

export function meta() {
  return [{ title: "Generate Matches | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: players } = await supabase.from("players").select("*");

  const { count: knockoutMatchCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .neq("phase", "league");

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

  const standings = calculateStandings(
    (players as Player[]) || [],
    (leagueMatches as MatchWithPlayers[]) || [],
  );
  const qualification = deriveStandingsQualification(standings);

  // Calculate league progress
  const totalPossibleMatches = players
    ? (players.length * (players.length - 1)) / 2
    : 0;
  const completedLeagueMatches = leagueMatches?.length || 0;

  return data(
    {
      playerCount: players?.length || 0,
      knockoutMatchCount: knockoutMatchCount || 0,
      leagueProgress: {
        completed: completedLeagueMatches,
        total: totalPossibleMatches,
        remaining: totalPossibleMatches - completedLeagueMatches,
      },
      canGenerateKnockout:
        qualification.qualifiedPlayerIds.length >= 10 &&
        (knockoutMatchCount || 0) === 0,
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { headers: authHeaders } = await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generate_knockout") {
    // Check if knockout matches already exist
    const { count: existingKnockout } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .neq("phase", "league");

    if (existingKnockout && existingKnockout > 0) {
      return {
        error:
          "Knockout matches already exist. Delete them first to regenerate.",
      };
    }

    const { data: players } = await supabase.from("players").select("*");

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

    const standings = calculateStandings(
      (players as Player[]) || [],
      (leagueMatches as MatchWithPlayers[]) || [],
    );
    const qualification = deriveStandingsQualification(standings);
    const qualified = qualification.qualifiedPlayerIds
      .map((playerId) =>
        standings.find((standing) => standing.player.id === playerId),
      )
      .filter((standing): standing is PlayerStanding => Boolean(standing));

    if (qualified.length < 10) {
      return {
        error:
          "Need at least 10 eligible players with completed matches to generate knockout",
      };
    }

    // Generate round 1 matches: 3v10, 4v9, 5v8, 6v7
    const knockoutMatches = [
      {
        player1_id: qualified[2]!.player.id, // 3rd eligible
        player2_id: qualified[9]!.player.id, // 10th eligible
        phase: "knockout_r1",
        status: "scheduled",
        knockout_position: 1,
      },
      {
        player1_id: qualified[3]!.player.id, // 4th eligible
        player2_id: qualified[8]!.player.id, // 9th eligible
        phase: "knockout_r1",
        status: "scheduled",
        knockout_position: 2,
      },
      {
        player1_id: qualified[4]!.player.id, // 5th eligible
        player2_id: qualified[7]!.player.id, // 8th eligible
        phase: "knockout_r1",
        status: "scheduled",
        knockout_position: 3,
      },
      {
        player1_id: qualified[5]!.player.id, // 6th eligible
        player2_id: qualified[6]!.player.id, // 7th eligible
        phase: "knockout_r1",
        status: "scheduled",
        knockout_position: 4,
      },
    ];

    const { error } = await supabase.from("matches").insert(knockoutMatches);

    if (error) {
      return { error: error.message };
    }

    const allHeaders = new Headers(authHeaders);
    headers.forEach((value, key) => allHeaders.append(key, value));
    return redirect("/admin/matches", { headers: allHeaders });
  }

  return { error: "Unknown action" };
}

export default function AdminGenerate() {
  const {
    playerCount,
    knockoutMatchCount,
    leagueProgress,
    canGenerateKnockout,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="admin-page">
      <h1>Generate Matches</h1>

      {actionData?.error && (
        <div className="error-message">{actionData.error}</div>
      )}

      <div className="generate-sections">
        <section className="generate-section">
          <h2>League Progress</h2>
          <p>
            League matches are recorded on-demand. Editors can record matches
            between any two players who haven't played yet.
          </p>
          <div className="generate-stats">
            <p>Players: {playerCount}</p>
            <p>
              League matches: {leagueProgress.completed} /{" "}
              {leagueProgress.total}
            </p>
            <p>Remaining: {leagueProgress.remaining}</p>
          </div>
          <a href="/editor/record-league" className="btn btn-secondary">
            Record League Match
          </a>
        </section>

        <section className="generate-section">
          <h2>Knockout Bracket</h2>
          <p>
            Generate knockout round 1 matches based on league standings.
            <br />
            Matchups: 3rd vs 10th, 4th vs 9th, 5th vs 8th, 6th vs 7th
          </p>
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="generate_knockout"
              className="btn btn-primary"
              disabled={isSubmitting || !canGenerateKnockout}
            >
              {isSubmitting ? "Generating..." : "Generate Knockout R1"}
            </button>
          </Form>
          {knockoutMatchCount > 0 && (
            <p className="help-text">
              Knockout matches already exist. Go to Matches page to manage them.
            </p>
          )}
          {knockoutMatchCount === 0 && !canGenerateKnockout && (
            <p className="help-text">
              Need at least 10 eligible players with completed league matches.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
