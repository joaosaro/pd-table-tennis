import { Form, redirect, useLoaderData, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/record.$matchId";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { requireRole, getUser } from "~/lib/auth.server";
import type { MatchWithPlayers } from "~/lib/types";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.match) {
    return [{ title: "Record Match | PD Table Tennis" }];
  }
  return [
    {
      title: `Record: ${data.match.player1.name} vs ${data.match.player2.name} | PD Table Tennis`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireRole(request, ["admin", "editor"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: match } = await supabase
    .from("matches")
    .select(`
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `)
    .eq("id", params.matchId)
    .single();

  if (!match) {
    throw new Response("Match not found", { status: 404 });
  }

  return { match: match as MatchWithPlayers };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireRole(request, ["admin", "editor"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();

  const set1_p1 = parseInt(formData.get("set1_p1") as string) || 0;
  const set1_p2 = parseInt(formData.get("set1_p2") as string) || 0;
  const set2_p1 = parseInt(formData.get("set2_p1") as string) || 0;
  const set2_p2 = parseInt(formData.get("set2_p2") as string) || 0;
  const set3_p1 = formData.get("set3_p1") ? parseInt(formData.get("set3_p1") as string) : null;
  const set3_p2 = formData.get("set3_p2") ? parseInt(formData.get("set3_p2") as string) : null;

  // Calculate sets won
  let p1Sets = 0;
  let p2Sets = 0;

  if (set1_p1 > set1_p2) p1Sets++;
  else if (set1_p2 > set1_p1) p2Sets++;

  if (set2_p1 > set2_p2) p1Sets++;
  else if (set2_p2 > set2_p1) p2Sets++;

  if (set3_p1 !== null && set3_p2 !== null) {
    if (set3_p1 > set3_p2) p1Sets++;
    else if (set3_p2 > set3_p1) p2Sets++;
  }

  // Validate: someone must win 2 sets (best of 3)
  if (p1Sets < 2 && p2Sets < 2) {
    return { error: "Match must have a winner (best of 3 sets)" };
  }

  // Get the match to determine winner
  const { data: match } = await supabase
    .from("matches")
    .select("player1_id, player2_id")
    .eq("id", params.matchId)
    .single();

  if (!match) {
    return { error: "Match not found" };
  }

  const winnerId = p1Sets > p2Sets ? match.player1_id : match.player2_id;

  const { error } = await supabase
    .from("matches")
    .update({
      set1_p1,
      set1_p2,
      set2_p1,
      set2_p2,
      set3_p1,
      set3_p2,
      winner_id: winnerId,
      status: "completed",
      recorded_by: user.id,
      recorded_at: new Date().toISOString(),
    })
    .eq("id", params.matchId);

  if (error) {
    return { error: error.message };
  }

  return redirect("/schedule", { headers });
}

export default function RecordMatch() {
  const { match } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="page">
      <h1>Record Match Result</h1>

      <div className="record-match-header">
        <div className="record-player">
          <span className={`tier-badge tier-${match.player1.tier}`}>
            {match.player1.tier}
          </span>
          <span className="record-player-name">{match.player1.name}</span>
        </div>
        <span className="record-vs">vs</span>
        <div className="record-player">
          <span className="record-player-name">{match.player2.name}</span>
          <span className={`tier-badge tier-${match.player2.tier}`}>
            {match.player2.tier}
          </span>
        </div>
      </div>

      <Form method="post" className="record-form">
        {actionData?.error && (
          <div className="error-message">{actionData.error}</div>
        )}

        <div className="sets-input-grid">
          <div className="set-input-group">
            <label className="set-label">Set 1</label>
            <div className="set-inputs">
              <input
                type="number"
                name="set1_p1"
                min="0"
                max="99"
                defaultValue={match.set1_p1 ?? ""}
                placeholder={match.player1.name.split(" ")[0]}
                className="form-input score-input"
                required
                disabled={isSubmitting}
              />
              <span className="score-separator">-</span>
              <input
                type="number"
                name="set1_p2"
                min="0"
                max="99"
                defaultValue={match.set1_p2 ?? ""}
                placeholder={match.player2.name.split(" ")[0]}
                className="form-input score-input"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="set-input-group">
            <label className="set-label">Set 2</label>
            <div className="set-inputs">
              <input
                type="number"
                name="set2_p1"
                min="0"
                max="99"
                defaultValue={match.set2_p1 ?? ""}
                placeholder={match.player1.name.split(" ")[0]}
                className="form-input score-input"
                required
                disabled={isSubmitting}
              />
              <span className="score-separator">-</span>
              <input
                type="number"
                name="set2_p2"
                min="0"
                max="99"
                defaultValue={match.set2_p2 ?? ""}
                placeholder={match.player2.name.split(" ")[0]}
                className="form-input score-input"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="set-input-group">
            <label className="set-label">Set 3 (if needed)</label>
            <div className="set-inputs">
              <input
                type="number"
                name="set3_p1"
                min="0"
                max="99"
                defaultValue={match.set3_p1 ?? ""}
                placeholder={match.player1.name.split(" ")[0]}
                className="form-input score-input"
                disabled={isSubmitting}
              />
              <span className="score-separator">-</span>
              <input
                type="number"
                name="set3_p2"
                min="0"
                max="99"
                defaultValue={match.set3_p2 ?? ""}
                placeholder={match.player2.name.split(" ")[0]}
                className="form-input score-input"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Result"}
          </button>
          <a href="/schedule" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </Form>
    </div>
  );
}
