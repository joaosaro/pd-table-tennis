import {
  data,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type { Route } from "./+types/recommendations";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { requireRole } from "~/lib/auth.server";
import { generateRecommendations } from "~/lib/recommendations.server";
import type { Player, WeeklyRecommendationWithPlayers } from "~/lib/types";

export function meta() {
  return [{ title: "Match Suggestions | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers, user } = await requireRole(request, ["admin"]);
  const { supabase } = createSupabaseServerClient(request);

  // Fetch all players
  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("name");

  // Fetch current recommendations
  const { data: recommendations } = await supabase
    .from("weekly_recommendations")
    .select(
      `
      *,
      player1:players!weekly_recommendations_player1_id_fkey(*),
      player2:players!weekly_recommendations_player2_id_fkey(*)
    `
    )
    .order("week_date", { ascending: false })
    .order("is_extra_match", { ascending: true });

  // Get the latest week's recommendations
  const latestWeekDate = recommendations?.[0]?.week_date;
  const currentRecommendations =
    recommendations?.filter((r) => r.week_date === latestWeekDate) || [];

  return data(
    {
      players: (players as Player[]) || [],
      currentRecommendations:
        currentRecommendations as WeeklyRecommendationWithPlayers[],
      latestWeekDate,
      userId: user.id,
    },
    { headers }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { headers: authHeaders, user } = await requireRole(request, ["admin"]);
  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const allHeaders = new Headers(authHeaders);
  headers.forEach((value, key) => allHeaders.append(key, value));

  if (intent === "generate") {
    const weekDate = formData.get("week_date") as string;
    const playerIds = formData.getAll("player_ids") as string[];

    if (!weekDate || playerIds.length < 2) {
      return data(
        { error: "Please select at least 2 players and a week date" },
        { headers: allHeaders }
      );
    }

    // Fetch selected players
    const { data: players } = await supabase
      .from("players")
      .select("*")
      .in("id", playerIds);

    // Generate recommendations (random pairing)
    const recommendations = generateRecommendations((players as Player[]) || []);

    // Delete existing recommendations
    await supabase.from("weekly_recommendations").delete().neq("id", "");

    // Insert new recommendations
    if (recommendations.length > 0) {
      const { error } = await supabase.from("weekly_recommendations").insert(
        recommendations.map((rec) => ({
          week_date: weekDate,
          player1_id: rec.player1_id,
          player2_id: rec.player2_id,
          is_extra_match: rec.is_extra_match,
          created_by: user.id,
        }))
      );

      if (error) {
        return data(
          { error: "Failed to save recommendations" },
          { headers: allHeaders }
        );
      }
    }

    allHeaders.set("Location", "/admin/recommendations");
    return new Response(null, { status: 302, headers: allHeaders });
  }

  if (intent === "clear") {
    await supabase.from("weekly_recommendations").delete().neq("id", "");

    allHeaders.set("Location", "/admin/recommendations");
    return new Response(null, { status: 302, headers: allHeaders });
  }

  return data({ error: "Invalid action" }, { headers: allHeaders });
}

export default function AdminRecommendations() {
  const {
    players,
    currentRecommendations,
    latestWeekDate,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Get next Monday as default date
  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split("T")[0];
  };

  return (
    <div className="admin-page">
      <h1>Match Suggestions</h1>
      <p className="help-text">
        Generate weekly match suggestions for players. Players are randomly
        paired from the selected list.
      </p>

      {actionData?.error && (
        <div className="error-message">{actionData.error}</div>
      )}

      {currentRecommendations.length > 0 && (
        <section className="admin-section">
          <div className="section-header">
            <h2>
              Current Suggestions{" "}
              <span className="week-badge">
                Week of{" "}
                {new Date(latestWeekDate + "T00:00:00").toLocaleDateString()}
              </span>
            </h2>
            <Form method="post" style={{ display: "inline" }}>
              <button
                type="submit"
                name="intent"
                value="clear"
                className="btn btn-danger btn-small"
                disabled={isSubmitting}
              >
                Clear All
              </button>
            </Form>
          </div>

          <div className="recommendations-list">
            {currentRecommendations.map((rec) => (
              <div
                key={rec.id}
                className={`recommendation-card ${rec.is_extra_match ? "extra-match" : ""}`}
              >
                <div className="recommendation-players">
                  <span className="player-name">
                    {rec.player1.name}
                    <span className={`tier-badge tier-${rec.player1.tier}`}>
                      {rec.player1.tier}
                    </span>
                  </span>
                  <span className="vs">vs</span>
                  <span className="player-name">
                    {rec.player2.name}
                    <span className={`tier-badge tier-${rec.player2.tier}`}>
                      {rec.player2.tier}
                    </span>
                  </span>
                </div>
                {rec.is_extra_match && (
                  <span className="extra-badge">Extra</span>
                )}
              </div>
            ))}
          </div>

          <Link to="/recommendations" className="btn btn-secondary">
            View Public Page
          </Link>
        </section>
      )}

      <section className="admin-section">
        <h2>Generate New Suggestions</h2>

        <Form method="post">
          <div className="form-group">
            <label htmlFor="week_date" className="form-label">
              Week Date
            </label>
            <input
              type="date"
              id="week_date"
              name="week_date"
              className="form-input"
              defaultValue={getNextMonday()}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Select Players ({players.length} total)
            </label>
            <p className="help-text">
              Check players available to play this week
            </p>

            <div className="player-checkbox-grid">
              {players.map((player) => (
                <label key={player.id} className="checkbox-option">
                  <input type="checkbox" name="player_ids" value={player.id} />
                  <span className={`tier-badge tier-${player.tier}`}>
                    {player.tier}
                  </span>
                  <span className="player-checkbox-name">{player.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              name="intent"
              value="generate"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Generating..." : "Generate Suggestions"}
            </button>
          </div>
        </Form>
      </section>
    </div>
  );
}
