import {
  data,
  Form,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import { requireRole } from "~/lib/auth.server";
import { rebuildEloRatings } from "~/lib/elo-sync.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import type { Route } from "./+types/players.new";

export function meta() {
  return [{ title: "Add Player | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireRole(request, ["admin"]);
  return data({}, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { headers: authHeaders } = await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim();
  const department = (formData.get("department") as string)?.trim() || null;
  const slackHandleRaw = (formData.get("slack_handle") as string) || "";
  const slack_handle = normalizeSlackHandle(slackHandleRaw);
  const disabled = formData.get("disabled") === "on";

  if (!name) {
    return { error: "Name is required" };
  }

  const { error } = await supabase.from("players").insert({
    name,
    department,
    slack_handle,
    tier: 4,
    disabled,
  });

  if (error) {
    return { error: error.message };
  }

  await rebuildEloRatings(supabase);

  const allHeaders = new Headers(authHeaders);
  headers.forEach((value, key) => allHeaders.append(key, value));
  return redirect("/admin/players", { headers: allHeaders });
}

export default function AdminPlayersNew() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="admin-page">
      <h1>Add Player</h1>

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
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="slack_handle" className="form-label">
            Slack handle
          </label>
          <input
            type="text"
            id="slack_handle"
            name="slack_handle"
            className="form-input"
            placeholder="e.g. joaosaro"
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="disabled">
            <input
              type="checkbox"
              id="disabled"
              name="disabled"
              disabled={isSubmitting}
            />{" "}
            Disabled (left Pipedrive)
          </label>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Adding..." : "Add Player"}
          </button>
          <a href="/admin/players" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </Form>
    </div>
  );
}

function normalizeSlackHandle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return withoutAt.trim().toLowerCase() || null;
}
