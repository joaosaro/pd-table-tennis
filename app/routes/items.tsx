import { Form, useLoaderData, useNavigation } from "react-router";
import type { Route } from "./+types/items";
import { createSupabaseServerClient } from "~/lib/supabase.server";

interface Item {
  id: number;
  name: string;
  created_at: string;
}

// In-memory store for demo mode (when Supabase not configured)
let demoItems: Item[] = [
  { id: 1, name: "Raquete Butterfly", created_at: new Date().toISOString() },
  { id: 2, name: "Bolas Nittaku 3-Star", created_at: new Date().toISOString() },
  { id: 3, name: "Mesa Cornilleau", created_at: new Date().toISOString() },
];
let demoNextId = 4;

function isDemoMode() {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY;
}

export function meta() {
  return [{ title: "Items" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (isDemoMode()) {
    return { items: demoItems, error: null, demoMode: true };
  }

  const { supabase } = createSupabaseServerClient(request);
  const { data: items, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading items:", error);
    return { items: [], error: error.message, demoMode: false };
  }

  return { items: items ?? [], error: null, demoMode: false };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (isDemoMode()) {
    if (intent === "create") {
      const name = formData.get("name") as string;
      if (name?.trim()) {
        demoItems = [
          { id: demoNextId++, name: name.trim(), created_at: new Date().toISOString() },
          ...demoItems,
        ];
      }
    } else if (intent === "delete") {
      const id = Number(formData.get("id"));
      demoItems = demoItems.filter((item) => item.id !== id);
    }
    return new Response(null, { status: 302, headers: { Location: "/items" } });
  }

  const { supabase, headers } = createSupabaseServerClient(request);

  if (intent === "create") {
    const name = formData.get("name") as string;
    if (name?.trim()) {
      await supabase.from("items").insert({ name: name.trim() });
    }
  } else if (intent === "delete") {
    const id = formData.get("id") as string;
    await supabase.from("items").delete().eq("id", id);
  }

  return new Response(null, { status: 302, headers: { ...Object.fromEntries(headers), Location: "/items" } });
}

export default function Items() {
  const { items, error, demoMode } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="items-page">
      <h1>Items</h1>

      {demoMode && (
        <p className="demo-badge">Demo Mode - dados em memória</p>
      )}

      {error && <p className="error">Error: {error}</p>}

      <Form method="post" className="add-form">
        <input
          type="text"
          name="name"
          placeholder="Enter item name"
          required
          disabled={isSubmitting}
        />
        <button type="submit" name="intent" value="create" disabled={isSubmitting}>
          {isSubmitting ? "Adding..." : "Add Item"}
        </button>
      </Form>

      {items.length === 0 ? (
        <p className="empty">No items yet. Add one above!</p>
      ) : (
        <ul className="items-list">
          {(items as Item[]).map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <Form method="post" className="delete-form">
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" name="intent" value="delete" disabled={isSubmitting}>
                  Delete
                </button>
              </Form>
            </li>
          ))}
        </ul>
      )}

      <a href="/" className="back-link">← Back to Home</a>
    </main>
  );
}
