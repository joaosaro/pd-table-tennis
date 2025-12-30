import {
  data,
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { useState } from "react";
import { requireRole } from "~/lib/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Player } from "~/lib/types";
import type { Route } from "./+types/record-league";

export function meta() {
  return [{ title: "Record League Match | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin", "editor"]);

  const { supabase } = createSupabaseServerClient(request);

  // Get all players
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("name");

  // Get all completed league matches to know which pairs have already played
  const { data: completedMatches } = await supabase
    .from("matches")
    .select("player1_id, player2_id")
    .eq("phase", "league")
    .eq("status", "completed");

  // Build a set of played pairs (sorted IDs to make lookup consistent)
  const playedPairs = new Set<string>();
  (completedMatches || []).forEach((match) => {
    const ids = [match.player1_id, match.player2_id].sort();
    playedPairs.add(`${ids[0]}-${ids[1]}`);
  });

  return data(
    {
      players: (players as Player[]) || [],
      playedPairs: Array.from(playedPairs),
    },
    { headers }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers: authHeaders } = await requireRole(request, [
    "admin",
    "editor",
  ]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();

  const player1Id = formData.get("player1_id") as string;
  const player2Id = formData.get("player2_id") as string;

  if (!player1Id || !player2Id) {
    return { error: "Please select both players" };
  }

  if (player1Id === player2Id) {
    return { error: "Please select two different players" };
  }

  // Check if this match already exists
  const { data: existingMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("phase", "league")
    .or(
      `and(player1_id.eq.${player1Id},player2_id.eq.${player2Id}),and(player1_id.eq.${player2Id},player2_id.eq.${player1Id})`
    )
    .single();

  if (existingMatch) {
    return { error: "This match has already been recorded" };
  }

  const set1_p1 = parseInt(formData.get("set1_p1") as string) || 0;
  const set1_p2 = parseInt(formData.get("set1_p2") as string) || 0;
  const set2_p1 = parseInt(formData.get("set2_p1") as string) || 0;
  const set2_p2 = parseInt(formData.get("set2_p2") as string) || 0;
  const set3_p1 = formData.get("set3_p1")
    ? parseInt(formData.get("set3_p1") as string)
    : null;
  const set3_p2 = formData.get("set3_p2")
    ? parseInt(formData.get("set3_p2") as string)
    : null;

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

  const winnerId = p1Sets > p2Sets ? player1Id : player2Id;

  // Create the match with result in one step
  const { error } = await supabase.from("matches").insert({
    player1_id: player1Id,
    player2_id: player2Id,
    phase: "league",
    status: "completed",
    set1_p1,
    set1_p2,
    set2_p1,
    set2_p2,
    set3_p1,
    set3_p2,
    winner_id: winnerId,
    recorded_by: user.id,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    return { error: error.message };
  }

  const allHeaders = new Headers(authHeaders);
  headers.forEach((value, key) => allHeaders.append(key, value));
  return redirect("/results", { headers: allHeaders });
}

export default function RecordLeagueMatch() {
  const { players, playedPairs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");

  // Check if the selected pair has already played
  const hasPlayed = (() => {
    if (!player1Id || !player2Id) return false;
    const ids = [player1Id, player2Id].sort();
    return playedPairs.includes(`${ids[0]}-${ids[1]}`);
  })();

  // Get player objects for display
  const player1 = players.find((p) => p.id === player1Id);
  const player2 = players.find((p) => p.id === player2Id);

  // Filter available players for each dropdown
  const availablePlayers2 = players.filter((p) => p.id !== player1Id);

  return (
    <div className="page">
      <h1>Record League Match</h1>

      <Form method="post" className="record-form">
        {actionData?.error && (
          <div className="error-message">{actionData.error}</div>
        )}

        {hasPlayed && (
          <div className="error-message">
            These players have already played each other
          </div>
        )}

        <div className="player-select-grid">
          <div className="form-group">
            <label htmlFor="player1_id">Player 1</label>
            <select
              id="player1_id"
              name="player1_id"
              className="form-select"
              value={player1Id}
              onChange={(e) => setPlayer1Id(e.target.value)}
              required
              disabled={isSubmitting}
            >
              <option value="">Select player...</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} (Tier {player.tier})
                </option>
              ))}
            </select>
          </div>

          <div className="vs-separator">vs</div>

          <div className="form-group">
            <label htmlFor="player2_id">Player 2</label>
            <select
              id="player2_id"
              name="player2_id"
              className="form-select"
              value={player2Id}
              onChange={(e) => setPlayer2Id(e.target.value)}
              required
              disabled={isSubmitting || !player1Id}
            >
              <option value="">Select player...</option>
              {availablePlayers2.map((player) => {
                const ids = [player1Id, player.id].sort();
                const alreadyPlayed = playedPairs.includes(
                  `${ids[0]}-${ids[1]}`
                );
                return (
                  <option
                    key={player.id}
                    value={player.id}
                    disabled={alreadyPlayed}
                  >
                    {player.name} (Tier {player.tier})
                    {alreadyPlayed ? " ✓ played" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {player1 && player2 && !hasPlayed && (
          <>
            <div className="record-match-header">
              <div className="record-player">
                <span className={`tier-badge tier-${player1.tier}`}>
                  {player1.tier}
                </span>
                <span className="record-player-name">{player1.name}</span>
              </div>
              <span className="record-vs">vs</span>
              <div className="record-player">
                <span className="record-player-name">{player2.name}</span>
                <span className={`tier-badge tier-${player2.tier}`}>
                  {player2.tier}
                </span>
              </div>
            </div>

            <div className="sets-input-grid">
              <div className="set-input-group">
                <label className="set-label">Set 1</label>
                <div className="set-inputs">
                  <input
                    type="number"
                    name="set1_p1"
                    min="0"
                    max="99"
                    placeholder={player1.name.split(" ")[0]}
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
                    placeholder={player2.name.split(" ")[0]}
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
                    placeholder={player1.name.split(" ")[0]}
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
                    placeholder={player2.name.split(" ")[0]}
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
                    placeholder={player1.name.split(" ")[0]}
                    className="form-input score-input"
                    disabled={isSubmitting}
                  />
                  <span className="score-separator">-</span>
                  <input
                    type="number"
                    name="set3_p2"
                    min="0"
                    max="99"
                    placeholder={player2.name.split(" ")[0]}
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
                disabled={isSubmitting || hasPlayed}
              >
                {isSubmitting ? "Saving..." : "Save Result"}
              </button>
              <a href="/editor/matches" className="btn btn-secondary">
                Cancel
              </a>
            </div>
          </>
        )}
      </Form>
    </div>
  );
}
