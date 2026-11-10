import { Form, useLoaderData, useNavigation, data } from "react-router";
import type { Route } from "./+types/tiers";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { requireRole } from "~/lib/auth.server";
import type { Player } from "~/lib/types";

export function meta() {
  return [{ title: "Assign Tiers | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("tier")
    .order("name");

  return data({ players: (players as Player[]) || [] }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { headers: authHeaders } = await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();

  // Update all player tiers
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("tier_")) {
      const playerId = key.replace("tier_", "");
      const tier = parseInt(value as string);
      await supabase.from("players").update({ tier }).eq("id", playerId);
    }
  }

  const allHeaders = new Headers(authHeaders);
  headers.forEach((value, key) => allHeaders.append(key, value));
  allHeaders.set("Location", "/admin/tiers");
  return new Response(null, { status: 302, headers: allHeaders });
}

export default function AdminTiers() {
  const { players } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

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
    <div className="admin-page">
      <h1>Assign Tiers</h1>
      <p className="help-text">
        Tier determines points earned when defeating a player:
        <br />
        Tier 1 (hardest) = 4 pts | Tier 2 = 3 pts | Tier 3 = 2 pts | Tier 4
        (easiest) = 1 pt
      </p>

      <Form method="post">
        <div className="tiers-grid">
          {[1, 2, 3, 4].map((tier) => (
            <div key={tier} className="tier-column">
              <h3>
                <span className={`tier-badge tier-${tier}`}>{tier}</span>
                Tier {tier}
                <span className="tier-count">
                  ({playersByTier[tier]?.length || 0})
                </span>
              </h3>
              <div className="tier-players">
                {players.map((player) => (
                  <label
                    key={`${tier}-${player.id}`}
                    className={`tier-player-option ${player.tier === tier ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`tier_${player.id}`}
                      value={tier}
                      defaultChecked={player.tier === tier}
                    />
                    <span>{player.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Tiers"}
          </button>
        </div>
      </Form>
    </div>
  );
}
