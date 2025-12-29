import { Form, redirect, useLoaderData, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/players.$id.edit";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { requireRole } from "~/lib/auth.server";
import type { Player } from "~/lib/types";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Edit ${data?.player?.name || "Player"} | PD Table Tennis` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!player) {
    throw new Response("Player not found", { status: 404 });
  }

  return { player: player as Player };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim();
  const department = (formData.get("department") as string)?.trim() || null;
  const tier = parseInt(formData.get("tier") as string) || 4;

  if (!name) {
    return { error: "Name is required" };
  }

  const { error } = await supabase
    .from("players")
    .update({ name, department, tier })
    .eq("id", params.id);

  if (error) {
    return { error: error.message };
  }

  return redirect("/admin/players", { headers });
}

export default function AdminPlayersEdit() {
  const { player } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="admin-page">
      <h1>Edit Player</h1>

      <Form method="post" className="admin-form">
        {actionData?.error && (
          <div className="error-message">{actionData.error}</div>
        )}

        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            className="form-input"
            defaultValue={player.name}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="department" className="form-label">
            Department
          </label>
          <input
            type="text"
            id="department"
            name="department"
            className="form-input"
            defaultValue={player.department || ""}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="tier" className="form-label">
            Tier
          </label>
          <select
            id="tier"
            name="tier"
            className="form-select"
            defaultValue={player.tier}
            disabled={isSubmitting}
          >
            <option value="1">Tier 1 (Hardest - 4 pts)</option>
            <option value="2">Tier 2 (3 pts)</option>
            <option value="3">Tier 3 (2 pts)</option>
            <option value="4">Tier 4 (Easiest - 1 pt)</option>
          </select>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <a href="/admin/players" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </Form>
    </div>
  );
}
