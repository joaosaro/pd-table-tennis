import { data, Link, useLoaderData } from "react-router";
import { requireRole } from "~/lib/auth.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/index";

export function meta() {
  return [{ title: "Admin | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { count: playerCount } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true });

  const { count: totalMatches } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true });

  const { count: completedMatches } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed");

  const { count: userCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  return data(
    {
      playerCount: playerCount || 0,
      totalMatches: totalMatches || 0,
      completedMatches: completedMatches || 0,
      userCount: userCount || 0,
    },
    { headers }
  );
}

export default function AdminIndex() {
  const { playerCount, totalMatches, completedMatches, userCount } =
    useLoaderData<typeof loader>();

  return (
    <div className="admin-page">
      <h1>Admin Dashboard</h1>

      <div className="admin-stats">
        <div className="stat-card">
          <span className="stat-value">{playerCount}</span>
          <span className="stat-label">Players</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalMatches}</span>
          <span className="stat-label">Total Matches</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{completedMatches}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{userCount}</span>
          <span className="stat-label">Users</span>
        </div>
      </div>

      <div className="admin-quick-actions">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          <Link to="/admin/players/new" className="action-card">
            <h3>Add Player</h3>
            <p>Register a new tournament participant</p>
          </Link>
          <Link to="/admin/generate" className="action-card">
            <h3>Generate Matches</h3>
            <p>Create league or knockout matches</p>
          </Link>
          <Link to="/admin/tiers" className="action-card">
            <h3>Assign Tiers</h3>
            <p>Set player skill tiers</p>
          </Link>
          <Link to="/admin/users" className="action-card">
            <h3>Manage Users</h3>
            <p>Assign roles to users</p>
          </Link>
        </div>
      </div>

      <nav className="admin-nav-links">
        <Link to="/admin/players">Manage Players</Link>
        <Link to="/admin/matches">Manage Matches</Link>
        <Link to="/admin/settings">Tournament Settings</Link>
        <a href="/admin/export-results" download>
          Export Results (CSV)
        </a>
      </nav>
    </div>
  );
}
