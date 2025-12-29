import { redirect } from "react-router";
import { createSupabaseServerClient } from "./supabase.server";
import type { AppUser, UserRole } from "./types";

/**
 * Get the current authenticated user from the request.
 * Returns null if not authenticated, along with headers for cookie updates.
 */
export async function getUser(
  request: Request
): Promise<{ user: AppUser | null; headers: Headers }> {
  const { supabase, headers } = createSupabaseServerClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, headers };
  }

  // Try to get app user from users table
  const { data: appUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!appUser) {
    // First login - check if this is the first user (becomes admin)
    // Use RPC to bypass RLS when counting users
    const { data: countData } = await supabase.rpc("get_user_count");
    const isFirstUser = countData === 0;

    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        role: isFirstUser ? "admin" : "viewer",
      })
      .select()
      .single();

    if (error || !newUser) {
      console.error("Failed to create user:", error);
      return { user: null, headers };
    }

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        avatarUrl: newUser.avatar_url,
        role: newUser.role as UserRole,
        playerId: newUser.player_id,
      },
      headers,
    };
  }

  return {
    user: {
      id: appUser.id,
      email: appUser.email,
      fullName: appUser.full_name,
      avatarUrl: appUser.avatar_url,
      role: appUser.role as UserRole,
      playerId: appUser.player_id,
    },
    headers,
  };
}

/**
 * Require an authenticated user. Redirects to login if not authenticated.
 */
export async function requireUser(
  request: Request
): Promise<{ user: AppUser; headers: Headers }> {
  const { user, headers } = await getUser(request);

  if (!user) {
    const url = new URL(request.url);
    throw redirect(`/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  return { user, headers };
}

/**
 * Require a user with one of the specified roles.
 * Throws 403 if user doesn't have required role.
 */
export async function requireRole(
  request: Request,
  allowedRoles: UserRole[]
): Promise<{ user: AppUser; headers: Headers }> {
  const { user, headers } = await requireUser(request);

  if (!allowedRoles.includes(user.role)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { user, headers };
}

/**
 * Check if user has admin role
 */
export function isAdmin(user: AppUser | null): boolean {
  return user?.role === "admin";
}

/**
 * Check if user can edit (admin or editor role)
 */
export function canEdit(user: AppUser | null): boolean {
  return user?.role === "admin" || user?.role === "editor";
}
