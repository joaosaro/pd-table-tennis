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
  buildInitialKnockoutMatches,
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

  const { count: completedKnockoutMatchCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .neq("phase", "league")
    .eq("status", "completed");

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
      completedKnockoutMatchCount: completedKnockoutMatchCount || 0,
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

    const knockoutMatches = buildInitialKnockoutMatches(qualified);

    const { error } = await supabase.from("matches").insert(knockoutMatches);

    if (error) {
      return { error: error.message };
    }

    const allHeaders = new Headers(authHeaders);
    headers.forEach((value, key) => allHeaders.append(key, value));
    return redirect("/admin/matches", { headers: allHeaders });
  }

  if (intent === "repair_knockout") {
    const { data: existingKnockoutMatches } = await supabase
      .from("matches")
      .select("id, status")
      .neq("phase", "league");

    const knockoutMatches = existingKnockoutMatches || [];

    if (knockoutMatches.length === 0) {
      return { error: "No knockout matches exist to repair." };
    }

    if (knockoutMatches.some((match) => match.status === "completed")) {
      return {
        error:
          "Cannot repair the knockout bracket after knockout matches have been completed.",
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
          "Need at least 10 eligible players with completed matches to repair knockout.",
      };
    }

    const { error: deleteError } = await supabase
      .from("matches")
      .delete()
      .neq("phase", "league");

    if (deleteError) {
      return { error: deleteError.message };
    }

    const repairedMatches = buildInitialKnockoutMatches(qualified);
    const { error: insertError } = await supabase
      .from("matches")
      .insert(repairedMatches);

    if (insertError) {
      return { error: insertError.message };
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
    completedKnockoutMatchCount,
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
            Matchups: 4th vs 9th, 5th vs 8th, 3rd vs 10th, 6th vs 7th
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
            <>
              <p className="help-text">Knockout matches already exist.</p>
              <Form method="post">
                <button
                  type="submit"
                  name="intent"
                  value="repair_knockout"
                  className="btn btn-secondary"
                  disabled={isSubmitting || completedKnockoutMatchCount > 0}
                >
                  {isSubmitting ? "Updating..." : "Repair Knockout Bracket"}
                </button>
              </Form>
              {completedKnockoutMatchCount > 0 && (
                <p className="help-text">
                  Repair is disabled because knockout matches have already been
                  completed.
                </p>
              )}
            </>
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
