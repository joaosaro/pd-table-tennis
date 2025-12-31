import type { Route } from "./+types/export-results";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { requireRole } from "~/lib/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, ["admin"]);

  const { supabase } = createSupabaseServerClient(request);

  // Fetch all completed matches with player details
  const { data: matches, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      phase,
      status,
      set1_p1,
      set1_p2,
      set2_p1,
      set2_p2,
      set3_p1,
      set3_p2,
      winner_id,
      recorded_at,
      player1:players!matches_player1_id_fkey(id, name, department, tier),
      player2:players!matches_player2_id_fkey(id, name, department, tier)
    `
    )
    .eq("status", "completed")
    .order("recorded_at", { ascending: true });

  if (error) {
    throw new Response("Failed to fetch matches", { status: 500 });
  }

  // Build CSV content
  const headers = [
    "Match ID",
    "Phase",
    "Player 1",
    "Player 1 Department",
    "Player 1 Tier",
    "Player 2",
    "Player 2 Department",
    "Player 2 Tier",
    "Set 1",
    "Set 2",
    "Set 3",
    "Winner",
    "Recorded At",
  ];

  const rows = matches.map((match) => {
    const player1 = match.player1 as unknown as { id: string; name: string; department: string | null; tier: number };
    const player2 = match.player2 as unknown as { id: string; name: string; department: string | null; tier: number };
    const winner = match.winner_id === player1.id ? player1.name : player2.name;

    const set1 = match.set1_p1 !== null ? `${match.set1_p1}-${match.set1_p2}` : "";
    const set2 = match.set2_p1 !== null ? `${match.set2_p1}-${match.set2_p2}` : "";
    const set3 = match.set3_p1 !== null ? `${match.set3_p1}-${match.set3_p2}` : "";

    return [
      match.id,
      formatPhase(match.phase),
      player1.name,
      player1.department || "",
      player1.tier,
      player2.name,
      player2.department || "",
      player2.tier,
      set1,
      set2,
      set3,
      winner,
      match.recorded_at ? new Date(match.recorded_at).toISOString() : "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map(escapeCsvField).join(",")),
  ].join("\n");

  const filename = `tournament-results-${new Date().toISOString().split("T")[0]}.csv`;

  return new Response(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function formatPhase(phase: string): string {
  const phaseLabels: Record<string, string> = {
    league: "League",
    knockout_r1: "Knockout Round 1",
    knockout_r2: "Knockout Round 2",
    semifinal: "Semifinal",
    final: "Final",
  };
  return phaseLabels[phase] || phase;
}

function escapeCsvField(field: unknown): string {
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
