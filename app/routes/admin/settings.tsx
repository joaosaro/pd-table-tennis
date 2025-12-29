import { Form, useLoaderData, useActionData, useNavigation, data } from "react-router";
import type { Route } from "./+types/settings";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { requireRole } from "~/lib/auth.server";
import type { TournamentSettings } from "~/lib/types";

export function meta() {
  return [{ title: "Tournament Settings | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: settings } = await supabase
    .from("tournament_settings")
    .select("*")
    .single();

  return data({ settings: settings as TournamentSettings | null }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { headers: authHeaders } = await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim() || "PD Table Tennis";
  const leagueDeadline = formData.get("league_deadline") as string || null;
  const isActive = formData.get("is_active") === "true";

  const { error } = await supabase
    .from("tournament_settings")
    .update({
      name,
      league_deadline: leagueDeadline || null,
      is_active: isActive,
    })
    .eq("id", 1);

  if (error) {
    return data({ error: error.message }, { headers: authHeaders });
  }

  return data({ success: true }, { headers: authHeaders });
}

export default function AdminSettings() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="admin-page">
      <h1>Tournament Settings</h1>

      <Form method="post" className="admin-form">
        {"error" in (actionData || {}) && (
          <div className="error-message">{(actionData as { error: string }).error}</div>
        )}
        {"success" in (actionData || {}) && (
          <div className="success-message">Settings saved successfully!</div>
        )}

        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Tournament Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            className="form-input"
            defaultValue={settings?.name || "PD Table Tennis"}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="league_deadline" className="form-label">
            League Deadline
          </label>
          <input
            type="date"
            id="league_deadline"
            name="league_deadline"
            className="form-input"
            defaultValue={settings?.league_deadline || ""}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tournament Status</label>
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="is_active"
                value="true"
                defaultChecked={settings?.is_active !== false}
              />
              <span>Active</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="is_active"
                value="false"
                defaultChecked={settings?.is_active === false}
              />
              <span>Completed</span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </Form>
    </div>
  );
}
