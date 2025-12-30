import { Form, Link, data, useLoaderData } from "react-router";
import { requireRole } from "~/lib/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { MatchWithPlayers } from "~/lib/types";
import type { Route } from "./+types/matches";

export function meta() {
  return [{ title: "Manage Matches | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: matches } = await supabase
    .from("matches")
    .select(
      `
      *,
      player1:players!matches_player1_id_fkey(*),
      player2:players!matches_player2_id_fkey(*)
    `
    )
    .order("phase")
    .order("created_at");

  return data({ matches: (matches as MatchWithPlayers[]) || [] }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { headers: authHeaders } = await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await supabase.from("matches").delete().eq("id", id);
  }

  if (intent === "delete_all_league") {
    await supabase.from("matches").delete().eq("phase", "league");
  }

  if (intent === "delete_all_knockout") {
    await supabase.from("matches").delete().neq("phase", "league");
  }

  if (intent === "reset_tournament") {
    await supabase.from("matches").delete().neq("id", "");
  }

  const allHeaders = new Headers(authHeaders);
  headers.forEach((value, key) => allHeaders.append(key, value));
  allHeaders.set("Location", "/admin/matches");
  return new Response(null, { status: 302, headers: allHeaders });
}

export default function AdminMatches() {
  const { matches } = useLoaderData<typeof loader>();

  const leagueMatches = matches.filter((m) => m.phase === "league");
  const knockoutMatches = matches.filter((m) => m.phase !== "league");

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Manage Matches</h1>
        <div className="header-actions">
          <Link to="/admin/generate" className="btn btn-primary">
            Generate Matches
          </Link>
          {matches.length > 0 && (
            <Form method="post" style={{ display: "inline" }}>
              <button
                type="submit"
                name="intent"
                value="reset_tournament"
                className="btn btn-danger"
                onClick={(e) => {
                  if (
                    !confirm(
                      "Are you sure you want to reset the tournament? This will delete ALL matches (league and knockout) and cannot be undone."
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                Reset Tournament
              </button>
            </Form>
          )}
        </div>
      </div>

      <section className="admin-section">
        <div className="section-header">
          <h2>League Matches ({leagueMatches.length})</h2>
          {leagueMatches.length > 0 && (
            <Form method="post" style={{ display: "inline" }}>
              <button
                type="submit"
                name="intent"
                value="delete_all_league"
                className="btn btn-danger"
                onClick={(e) => {
                  if (!confirm("Delete ALL league matches?")) {
                    e.preventDefault();
                  }
                }}
              >
                Delete All League
              </button>
            </Form>
          )}
        </div>
        <MatchTable matches={leagueMatches} />
      </section>

      <section className="admin-section">
        <div className="section-header">
          <h2>Knockout Matches ({knockoutMatches.length})</h2>
          {knockoutMatches.length > 0 && (
            <Form method="post" style={{ display: "inline" }}>
              <button
                type="submit"
                name="intent"
                value="delete_all_knockout"
                className="btn btn-danger"
                onClick={(e) => {
                  if (!confirm("Delete ALL knockout matches?")) {
                    e.preventDefault();
                  }
                }}
              >
                Delete All Knockout
              </button>
            </Form>
          )}
        </div>
        <MatchTable matches={knockoutMatches} />
      </section>
    </div>
  );
}

function MatchTable({ matches }: { matches: MatchWithPlayers[] }) {
  if (matches.length === 0) {
    return <p className="empty">No matches.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Player 1</th>
          <th>Player 2</th>
          <th>Phase</th>
          <th>Status</th>
          <th className="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((match) => (
          <tr key={match.id}>
            <td>
              <span
                className={match.winner_id === match.player1_id ? "winner" : ""}
              >
                {match.player1.name}
              </span>
            </td>
            <td>
              <span
                className={match.winner_id === match.player2_id ? "winner" : ""}
              >
                {match.player2.name}
              </span>
            </td>
            <td>
              <span className={`phase-badge ${match.phase}`}>
                {match.phase}
              </span>
            </td>
            <td>
              <span className={`status-badge ${match.status}`}>
                {match.status}
              </span>
            </td>
            <td className="text-right">
              <div className="action-buttons">
                {match.status === "scheduled" && (
                  <Link
                    to={`/editor/record/${match.id}`}
                    className="btn btn-primary"
                  >
                    Record
                  </Link>
                )}
                <Link to={`/match/${match.id}`} className="btn btn-secondary">
                  View
                </Link>
                <Form method="post" style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={match.id} />
                  <button
                    type="submit"
                    name="intent"
                    value="delete"
                    className="btn btn-danger"
                    onClick={(e) => {
                      if (!confirm("Delete this match?")) {
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
  );
}
