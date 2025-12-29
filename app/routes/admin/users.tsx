import { Form, useLoaderData, useNavigation, data } from "react-router";
import type { Route } from "./+types/users";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { requireRole } from "~/lib/auth.server";
import type { User } from "~/lib/types";

export function meta() {
  return [{ title: "Manage Users | PD Table Tennis" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { headers, user: currentUser } = await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  return data({ users: (users as User[]) || [], currentUserId: currentUser.id }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { headers: authHeaders, user: currentUser } = await requireRole(request, ["admin"]);

  const { supabase, headers } = createSupabaseServerClient(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const userId = formData.get("user_id") as string;

  if (!userId) {
    return { error: "Missing user ID" };
  }

  // Prevent self-deletion
  if (intent === "delete" && userId === currentUser.id) {
    return { error: "You cannot delete your own account" };
  }

  let error;

  if (intent === "delete") {
    console.log("Deleting user:", userId);
    const result = await supabase.from("users").delete().eq("id", userId);
    console.log("Delete result:", result);
    error = result.error;
  } else {
    const role = formData.get("role") as string;
    if (!role) {
      return { error: "Missing role" };
    }
    const result = await supabase.from("users").update({ role }).eq("id", userId);
    error = result.error;
  }

  if (error) {
    return { error: error.message };
  }

  const allHeaders = new Headers(authHeaders);
  headers.forEach((value, key) => allHeaders.append(key, value));
  allHeaders.set("Location", "/admin/users");
  return new Response(null, { status: 302, headers: allHeaders });
}

export default function AdminUsers() {
  const { users, currentUserId } = useLoaderData<typeof loader>();
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
                <td className="text-right actions-cell">
                  <Form method="post" className="role-form">
                    <input type="hidden" name="user_id" value={user.id} />
                    <input type="hidden" name="intent" value="update" />
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
                  {user.id !== currentUserId && (
                    <Form
                      method="post"
                      className="delete-form"
                      onSubmit={(e) => {
                        if (!confirm(`Delete user ${user.email}?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="user_id" value={user.id} />
                      <input type="hidden" name="intent" value="delete" />
                      <button
                        type="submit"
                        className="btn btn-danger"
                        disabled={isSubmitting}
                      >
                        Delete
                      </button>
                    </Form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
