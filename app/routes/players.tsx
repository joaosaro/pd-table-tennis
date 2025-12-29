import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/players";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Player } from "~/lib/types";

export function meta() {
  return [
    { title: "Players | PD Table Tennis" },
    { name: "description", content: "Tournament participants" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);

  const { data: players, error } = await supabase
    .from("players")
    .select("*")
    .order("tier", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading players:", error);
  }

  return { players: (players as Player[]) || [] };
}

export default function Players() {
  const { players } = useLoaderData<typeof loader>();

  const playersByTier = players.reduce(
    (acc, player) => {
      const tier = player.tier;
      if (!acc[tier]) acc[tier] = [];
      acc[tier].push(player);
      return acc;
    },
    {} as Record<number, Player[]>
  );

  return (
    <main className="page">
      <div className="page-header">
        <h1>Players</h1>
        <p>{players.length} participants</p>
      </div>

      {players.length === 0 ? (
        <p className="empty">No players registered yet.</p>
      ) : (
        <div className="players-by-tier">
          {[1, 2, 3, 4].map(
            (tier) =>
              playersByTier[tier]?.length > 0 && (
                <section key={tier} className="tier-section">
                  <h2 className="tier-heading">
                    <span className={`tier-badge tier-${tier}`}>{tier}</span>
                    Tier {tier}
                    <span className="tier-points">({getTierPoints(tier as 1|2|3|4)} pts for win)</span>
                  </h2>
                  <div className="players-grid">
                    {playersByTier[tier].map((player) => (
                      <Link
                        key={player.id}
                        to={`/player/${player.id}`}
                        className="player-card"
                      >
                        <div className="player-avatar">
                          {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="player-info">
                          <span className="player-name">{player.name}</span>
                          {player.department && (
                            <span className="player-department">
                              {player.department}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )
          )}
        </div>
      )}
    </main>
  );
}

function getTierPoints(tier: 1 | 2 | 3 | 4): number {
  const points: Record<1 | 2 | 3 | 4, number> = { 1: 4, 2: 3, 3: 2, 4: 1 };
  return points[tier];
}
