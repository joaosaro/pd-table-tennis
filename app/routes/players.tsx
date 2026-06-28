import { Link, useLoaderData } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Player } from "~/lib/types";
import type { Route } from "./+types/players";

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
    .eq("disabled", false)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error loading players:", error);
  }

  return { players: (players as Player[]) || [] };
}

export default function Players() {
  const { players } = useLoaderData<typeof loader>();

  const playersByDepartment = players.reduce(
    (acc, player) => {
      const department = player.department?.trim() || "No department";

      if (!acc[department]) {
        acc[department] = [];
      }

      acc[department].push(player);

      return acc;
    },
    {} as Record<string, Player[]>,
  );
  const departmentNames = Object.keys(playersByDepartment).sort((a, b) => {
    if (a === "No department") return 1;
    if (b === "No department") return -1;

    return a.localeCompare(b);
  });

  return (
    <main className="page">
      <div className="page-header">
        <h1>Participants</h1>
        <p>{players.length} participants</p>
      </div>

      {players.length === 0 ? (
        <p className="empty">No players registered yet.</p>
      ) : (
        <div className="players-by-tier">
          {departmentNames.map((department) => (
            <section key={department} className="tier-section">
              <h2 className="tier-heading">{department}</h2>
              <div className="players-grid">
                {playersByDepartment[department].map((player) => (
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
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
