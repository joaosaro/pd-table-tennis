import { Form, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/users";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { requireRole } from "~/lib/auth.server";
import type { User } from "~/lib/types";

export function meta() {
  return [{ title: "Manage Users | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  return { users: (users as User[]) || [] };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();

  const userId = formData.get("user_id") as string;
  const role = formData.get("role") as string;

  if (!userId || !role) {
    return { error: "Missing user ID or role" };
  }

  const { error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  return new Response(null, {
    status: 302,
    headers: { ...Object.fromEntries(headers), Location: "/admin/users" },
  });
}

export default function AdminUsers() {
  const { users } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="admin-page">
      <h1>Manage Users</h1>
      <p className="help-text">
        Users are created when they sign in with Google. Assign roles to control
        access.
      </p>

      {users.length === 0 ? (
        <p className="empty">No users have signed in yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Joined</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.full_name || "-"}</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="text-right">
                  <Form method="post" className="role-form">
                    <input type="hidden" name="user_id" value={user.id} />
                    <select
                      name="role"
                      defaultValue={user.role}
                      className="form-select role-select"
                      disabled={isSubmitting}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSubmitting}
                    >
                      Save
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
