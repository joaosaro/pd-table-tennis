import { Link, useLoaderData, Form } from "react-router";
import type { Route } from "./+types/players";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { requireRole } from "~/lib/auth.server";
import type { Player } from "~/lib/types";

export function meta() {
  return [{ title: "Manage Players | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .order("name");

  return { players: (players as Player[]) || [] };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await supabase.from("players").delete().eq("id", id);
  }

  return new Response(null, {
    status: 302,
    headers: { ...Object.fromEntries(headers), Location: "/admin/players" },
  });
}

export default function AdminPlayers() {
  const { players } = useLoaderData<typeof loader>();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Manage Players</h1>
        <Link to="/admin/players/new" className="btn btn-primary">
          Add Player
        </Link>
      </div>

      {players.length === 0 ? (
        <p className="empty">No players registered yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th className="text-center">Tier</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>
                  <Link to={`/player/${player.id}`}>{player.name}</Link>
                </td>
                <td>{player.department || "-"}</td>
                <td className="text-center">
                  <span className={`tier-badge tier-${player.tier}`}>
                    {player.tier}
                  </span>
                </td>
                <td className="text-right">
                  <div className="action-buttons">
                    <Link
                      to={`/admin/players/${player.id}/edit`}
                      className="btn btn-secondary"
                    >
                      Edit
                    </Link>
                    <Form method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={player.id} />
                      <button
                        type="submit"
                        name="intent"
                        value="delete"
                        className="btn btn-danger"
                        onClick={(e) => {
                          if (!confirm(`Delete ${player.name}?`)) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </Form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
