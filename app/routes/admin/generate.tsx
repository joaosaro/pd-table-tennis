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
  generateLeagueMatchPairs,
} from "~/lib/tournament.server";
import type { MatchWithPlayers, Player } from "~/lib/types";
import type { Route } from "./+types/generate";

export function meta() {
  return [{ title: "Generate Matches | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: players } = await supabase.from("players").select("*");

  const { count: leagueMatchCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("phase", "league");

  const { data: leagueMatches } = await supabase
    .from("matches")
    .select(
      `
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `
    )
    .eq("phase", "league")
    .eq("status", "completed");

  const standings = calculateStandings(
    (players as Player[]) || [],
    (leagueMatches as MatchWithPlayers[]) || []
  );

  return data(
    {
      playerCount: players?.length || 0,
      leagueMatchCount: leagueMatchCount || 0,
      expectedLeagueMatches: players
        ? (players.length * (players.length - 1)) / 2
        : 0,
      canGenerateKnockout: standings.length >= 10,
    },
    { headers }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { headers: authHeaders } = await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generate_league") {
    const { data: players } = await supabase.from("players").select("*");

    if (!players || players.length < 2) {
      return { error: "Need at least 2 players to generate matches" };
    }

    // Check if league matches already exist
    const { count } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("phase", "league");

    if (count && count > 0) {
      return {
        error: "League matches already exist. Delete them first to regenerate.",
      };
    }

    const pairs = generateLeagueMatchPairs(players as Player[]);
    const matches = pairs.map(([p1, p2]) => ({
      player1_id: p1.id,
      player2_id: p2.id,
      phase: "league",
      status: "scheduled",
    }));

    const { error } = await supabase.from("matches").insert(matches);

    if (error) {
      return { error: error.message };
    }

    const allHeaders = new Headers(authHeaders);
    headers.forEach((value, key) => allHeaders.append(key, value));
    return redirect("/admin/matches", { headers: allHeaders });
  }

  if (intent === "generate_knockout") {
    const { data: players } = await supabase.from("players").select("*");

    const { data: leagueMatches } = await supabase
      .from("matches")
      .select(
        `
        *,
        player1:players!matches_player1_id_fkey(*),
        player2:players!matches_player2_id_fkey(*)
      `
      )
      .eq("phase", "league")
      .eq("status", "completed");

    const standings = calculateStandings(
      (players as Player[]) || [],
      (leagueMatches as MatchWithPlayers[]) || []
    );

    if (standings.length < 10) {
      return {
        error:
          "Need at least 10 players with completed matches to generate knockout",
      };
    }

    // Generate round 1 matches: 3v10, 4v9, 5v8, 6v7
    const knockoutMatches = [
      {
        player1_id: standings[2].player.id, // 3rd
        player2_id: standings[9].player.id, // 10th
        phase: "knockout_r1",
        status: "scheduled",
        knockout_position: 1,
      },
      {
        player1_id: standings[3].player.id, // 4th
        player2_id: standings[8].player.id, // 9th
        phase: "knockout_r1",
        status: "scheduled",
        knockout_position: 2,
      },
      {
        player1_id: standings[4].player.id, // 5th
        player2_id: standings[7].player.id, // 8th
        phase: "knockout_r1",
        status: "scheduled",
        knockout_position: 3,
      },
      {
        player1_id: standings[5].player.id, // 6th
        player2_id: standings[6].player.id, // 7th
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
    leagueMatchCount,
    expectedLeagueMatches,
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
          <h2>League Matches</h2>
          <p>
            Generate round-robin matches where each player plays every other
            player once.
          </p>
          <div className="generate-stats">
            <p>Players: {playerCount}</p>
            <p>
              League matches: {leagueMatchCount} / {expectedLeagueMatches}
            </p>
          </div>
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="generate_league"
              className="btn btn-primary"
              disabled={isSubmitting || playerCount < 2 || leagueMatchCount > 0}
            >
              {isSubmitting ? "Generating..." : "Generate League Matches"}
            </button>
          </Form>
          {leagueMatchCount > 0 && (
            <p className="help-text">
              League matches already exist. Go to Matches page to manage them.
            </p>
          )}
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
          {!canGenerateKnockout && (
            <p className="help-text">
              Need at least 10 players with completed league matches.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
