import { useLoaderData } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { WeeklyRecommendationWithPlayers } from "~/lib/types";
import type { Route } from "./+types/recommendations";

export function meta() {
  return [
    { title: "Match Suggestions | PD Table Tennis" },
    { name: "description", content: "Weekly match suggestions" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  // Get recommendations with player data
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

  return {
    recommendations: currentRecommendations as WeeklyRecommendationWithPlayers[],
    weekDate: latestWeekDate,
  };
}

export default function Recommendations() {
  const { recommendations, weekDate } = useLoaderData<typeof loader>();

  return (
    <main className="page">
      <div className="page-header">
        <h1>Match Suggestions</h1>
        {weekDate && (
          <p className="week-subtitle">
            Week of {new Date(weekDate + "T00:00:00").toLocaleDateString()}
          </p>
        )}
      </div>

      {recommendations.length === 0 ? (
        <div className="empty-state">
          <p>No match suggestions available yet.</p>
          <p className="help-text">
            Check back later for this week&apos;s recommended matches.
          </p>
        </div>
      ) : (
        <div className="recommendations-grid">
          {recommendations.map((rec) => (
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
              {rec.is_extra_match && <span className="extra-badge">Extra</span>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
