// Database types matching Supabase schema

export type UserRole = "admin" | "editor" | "viewer";

export type MatchPhase =
  | "league"
  | "knockout_r1"
  | "knockout_r2"
  | "semifinal"
  | "final";

export type MatchStatus = "scheduled" | "completed";

export interface Player {
  id: string;
  name: string;
  department: string | null;
  tier: 1 | 2 | 3 | 4;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  player_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentSettings {
  id: number;
  name: string;
  league_deadline: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  phase: MatchPhase;
  status: MatchStatus;
  winner_id: string | null;
  set1_p1: number | null;
  set1_p2: number | null;
  set2_p1: number | null;
  set2_p2: number | null;
  set3_p1: number | null;
  set3_p2: number | null;
  knockout_position: number | null;
  recorded_by: string | null;
  recorded_at: string | null;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface MatchWithPlayers extends Match {
  player1: Player;
  player2: Player;
  winner?: Player | null;
}

// App user (simplified for UI)
export interface AppUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  playerId: string | null;
}

// Weekly recommendations
export interface WeeklyRecommendation {
  id: string;
  week_date: string;
  player1_id: string;
  player2_id: string;
  is_extra_match: boolean;
  created_by: string | null;
  created_at: string;
}

export interface WeeklyRecommendationWithPlayers extends WeeklyRecommendation {
  player1: Player;
  player2: Player;
}

// Standings calculation
export interface PlayerStanding {
  player: Player;
  rank: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  pointsScored: number;
  pointsConceded: number;
  pointDiff: number;
}

// Set score tuple
export type SetScore = [number, number];

// Knockout bracket structure
export interface KnockoutMatch {
  matchId: string | null;
  player1: Player | null;
  player2: Player | null;
  winner: Player | null;
  seed1: number;
  seed2: number;
}

export interface KnockoutBracket {
  round1: KnockoutMatch[]; // 3v10, 4v9, 5v8, 6v7
  round2: KnockoutMatch[]; // Winners reseeded
  semifinals: KnockoutMatch[]; // 1st + 2nd vs knockout winners
  final: KnockoutMatch | null;
}

// Points per tier (for wins)
export const TIER_POINTS: Record<1 | 2 | 3 | 4, number> = {
  1: 4,
  2: 3,
  3: 2,
  4: 1,
};
