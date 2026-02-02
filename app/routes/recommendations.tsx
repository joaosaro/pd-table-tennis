import { useEffect, useMemo, useState } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import {
  generateUnplayedLeagueMatchups,
  type MatchPairInput,
  type Matchup,
  type PlayerSummary,
} from "~/lib/suggestions";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Player, WeeklyRecommendationWithPlayers } from "~/lib/types";
import type { Route } from "./+types/recommendations";

export function meta() {
  return [
    { title: "Match Suggestions | PD Table Tennis" },
    { name: "description", content: "Weekly match suggestions" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  const { data: players } = await supabase
    .from("players")
    .select("id, name, tier, slack_handle")
    .order("name");

  // Get recommendations with player data
  const { data: recommendations } = await supabase
    .from("weekly_recommendations")
    .select(
      `
      *,
      player1:players!weekly_recommendations_player1_id_fkey(*),
      player2:players!weekly_recommendations_player2_id_fkey(*)
    `,
    )
    .order("week_date", { ascending: false })
    .order("is_extra_match", { ascending: true });

  // Get the latest week's recommendations
  const latestWeekDate = recommendations?.[0]?.week_date;
  const currentRecommendations =
    recommendations?.filter((r) => r.week_date === latestWeekDate) || [];

  const { data: completedMatches } = await supabase
    .from("matches")
    .select("player1_id, player2_id")
    .eq("phase", "league")
    .eq("status", "completed");

  return {
    players: (players as Player[]) || [],
    recommendations:
      currentRecommendations as WeeklyRecommendationWithPlayers[],
    weekDate: latestWeekDate,
    completedMatches: (completedMatches as MatchPairInput[]) || [],
  };
}

export default function Recommendations() {
  const { recommendations, weekDate, players, completedMatches } =
    useLoaderData<typeof loader>();
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [copiedTab, setCopiedTab] = useState<"weekly" | "custom" | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "custom" ? "custom" : "weekly";
  const [activeTab, setActiveTab] = useState<"weekly" | "custom">(initialTab);

  useEffect(() => {
    const nextTab =
      searchParams.get("tab") === "custom" ? "custom" : "weekly";
    setActiveTab(nextTab);
  }, [searchParams]);

  const selectedPlayers = useMemo(() => {
    if (selectedPlayerIds.length === 0) return [];
    const selectedSet = new Set(selectedPlayerIds);
    return players.filter((player) => selectedSet.has(player.id));
  }, [players, selectedPlayerIds]);

  const suggestedMatches = useMemo<Matchup[]>(() => {
    if (selectedPlayers.length < 2) return [];
    return generateUnplayedLeagueMatchups(
      selectedPlayers as PlayerSummary[],
      completedMatches,
    );
  }, [completedMatches, selectedPlayers]);

  const weeklyCopyText = useMemo(() => {
    if (!recommendations.length) return "";
    return recommendations
      .map(
        (rec) =>
          `${formatSlackLabel(rec.player1)} vs ${formatSlackLabel(rec.player2)}`
      )
      .join("\n");
  }, [recommendations]);

  const customCopyText = useMemo(() => {
    if (!suggestedMatches.length) return "";
    return suggestedMatches
      .map(
        (match) =>
          `${formatSlackLabel(match.player1)} vs ${formatSlackLabel(match.player2)}`
      )
      .join("\n");
  }, [suggestedMatches]);

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId],
    );
  };

  const setTab = (tab: "weekly" | "custom") => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams, { replace: true });
  };

  const copyToClipboard = async (
    tab: "weekly" | "custom",
    text: string
  ) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tab);
      window.setTimeout(() => setCopiedTab(null), 2000);
    } catch (error) {
      console.error("Failed to copy matches", error);
    }
  };

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

      <div className="tabs">
        <button
          type="button"
          className={`tab-button ${activeTab === "weekly" ? "is-active" : ""}`}
          onClick={() => setTab("weekly")}
        >
          App Weekly Recommendations
        </button>
        <button
          type="button"
          className={`tab-button ${activeTab === "custom" ? "is-active" : ""}`}
          onClick={() => setTab("custom")}
        >
          Custom Match Finder
        </button>
      </div>

      {activeTab === "weekly" ? (
        <section className="admin-section">
          <div className="section-header">
            <h2>This Week&apos;s Recommendations</h2>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setTab("custom")}
            >
              Try Match Finder
            </button>
          </div>
          {recommendations.length === 0 ? (
            <div className="empty-state">
              <p>No match suggestions available yet.</p>
              <p className="help-text">
                Check back later for this week&apos;s recommended matches.
              </p>
            </div>
          ) : (
            <>
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
                    {rec.is_extra_match && (
                      <span className="extra-badge">Extra</span>
                    )}
                  </div>
                ))}
              </div>
              <CopyBlock
                text={weeklyCopyText}
                onCopy={() => copyToClipboard("weekly", weeklyCopyText)}
                copied={copiedTab === "weekly"}
                title="Copy for Slack"
              />
            </>
          )}
        </section>
      ) : (
        <section className="admin-section">
          <div className="section-header">
            <h2>Custom Match Finder</h2>
            <span className="week-badge">
              {selectedPlayerIds.length} selected
            </span>
          </div>
          <p className="help-text">
            Select players to see all league matches they still need to play.
            Completed matches are excluded.
          </p>

          <div className="player-checkbox-grid">
            {players.map((player) => (
              <label key={player.id} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={selectedPlayerIds.includes(player.id)}
                  onChange={() => togglePlayer(player.id)}
                />
                <span className={`tier-badge tier-${player.tier}`}>
                  {player.tier}
                </span>
                <span className="player-checkbox-name">{player.name}</span>
              </label>
            ))}
          </div>

          {selectedPlayerIds.length < 2 ? (
            <div className="empty-state">
              <p>Select at least two players to generate matches.</p>
              <p className="help-text">
                The list updates instantly as you change the selection.
              </p>
            </div>
          ) : suggestedMatches.length === 0 ? (
            <div className="empty-state">
              <p>No unplayed league matches for this group.</p>
              <p className="help-text">
                Try selecting a different set of players.
              </p>
            </div>
          ) : (
            <>
              <div className="recommendations-grid">
                {suggestedMatches.map((match) => (
                  <div
                    key={`${match.player1.id}-${match.player2.id}`}
                    className="recommendation-card"
                  >
                    <div className="recommendation-players">
                      <span className="player-name">
                        {match.player1.name}
                        {match.player1.tier ? (
                          <span
                            className={`tier-badge tier-${match.player1.tier}`}
                          >
                            {match.player1.tier}
                          </span>
                        ) : null}
                      </span>
                      <span className="vs">vs</span>
                      <span className="player-name">
                        {match.player2.name}
                        {match.player2.tier ? (
                          <span
                            className={`tier-badge tier-${match.player2.tier}`}
                          >
                            {match.player2.tier}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <CopyBlock
                text={customCopyText}
                onCopy={() => copyToClipboard("custom", customCopyText)}
                copied={copiedTab === "custom"}
                title="Copy for Slack"
              />
            </>
          )}
        </section>
      )}
    </main>
  );
}

function formatSlackLabel(player: {
  name: string;
  slack_handle?: string | null;
}) {
  return player.slack_handle ? `@${player.slack_handle}` : player.name;
}

function CopyBlock({
  text,
  onCopy,
  copied,
  title,
}: {
  text: string;
  onCopy: () => void;
  copied: boolean;
  title: string;
}) {
  const rows = Math.min(8, Math.max(3, text.split("\n").length));

  return (
    <div className="copy-block">
      <div className="copy-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="copy-button"
          onClick={onCopy}
          aria-label="Copy to clipboard"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="copy-icon"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <textarea
        className="copy-textarea"
        readOnly
        value={text}
        rows={rows}
      />
    </div>
  );
}
