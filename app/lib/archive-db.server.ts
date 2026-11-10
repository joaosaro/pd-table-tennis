/**
 * Read-only, in-memory stand-in for the Supabase client.
 *
 * The Supabase database was retired. This app is now a memorial of the 2026
 * edition; its data lives in `app/data/archive/*.json` (generated from the
 * full backup in `archive/backup`). This module implements the subset of the
 * supabase-js query builder the app uses, so existing loaders keep working.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import players from "~/data/archive/players.json";
import matches from "~/data/archive/matches.json";
import tournamentSettings from "~/data/archive/tournament_settings.json";

type Row = Record<string, any>;

const tables: Record<string, Row[]> = {
  players,
  matches,
  tournament_settings: tournamentSettings,
  users: [],
  weekly_recommendations: [],
};

const playersById = new Map<string, Row>(players.map((p) => [p.id, p]));

/** Matches embeds like `player1:players!matches_player1_id_fkey(*)` */
const EMBED_RE = /(\w+)\s*:\s*players!(\w+)_fkey\s*\(\s*\*\s*\)/g;

/** Foreign key constraint name (without `_fkey`) -> local column. */
const PLAYER_FOREIGN_KEYS: Record<string, string> = {
  matches_player1_id: "player1_id",
  matches_player2_id: "player2_id",
  matches_winner_id: "winner_id",
  weekly_recommendations_player1_id: "player1_id",
  weekly_recommendations_player2_id: "player2_id",
};

const READ_ONLY_ERROR = {
  message: "The tournament database has been archived and is read-only.",
  code: "ARCHIVED",
};

type Filter = (row: Row) => boolean;

function compare(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return (a as any) < (b as any) ? -1 : 1;
}

function parseOrFilter(expression: string): Filter {
  const clauses = expression.split(",").map((clause) => {
    const [column, op, ...rest] = clause.split(".");
    const value = rest.join(".");
    if (op !== "eq") {
      // Only simple `col.eq.value` clauses are used by read paths.
      return () => false;
    }
    return (row: Row) => String(row[column]) === value;
  });
  return (row) => clauses.some((clause) => clause(row));
}

class QueryBuilder implements PromiseLike<any> {
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private offset = 0;
  private columns = "*";
  private countMode = false;
  private headOnly = false;
  private singleMode: "single" | "maybeSingle" | null = null;
  private isWrite = false;

  constructor(private table: string) {}

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    this.columns = columns;
    this.countMode = Boolean(options?.count);
    this.headOnly = Boolean(options?.head);
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push((row) => row[column] > value);
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((row) => row[column] >= value);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((row) => row[column] < value);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((row) => row[column] <= value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === "is") {
      this.filters.push((row) => row[column] !== value);
    } else if (operator === "eq") {
      this.filters.push((row) => row[column] !== value);
    } else {
      throw new Error(`Unsupported .not() operator: ${operator}`);
    }
    return this;
  }

  or(expression: string) {
    this.filters.push(parseOrFilter(expression));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.offset = from;
    this.limitCount = to - from + 1;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  // Mutations are not supported: the archive is read-only.
  insert() {
    this.isWrite = true;
    return this;
  }
  update() {
    this.isWrite = true;
    return this;
  }
  upsert() {
    this.isWrite = true;
    return this;
  }
  delete() {
    this.isWrite = true;
    return this;
  }

  private project(row: Row): Row {
    const embeds = [...this.columns.matchAll(EMBED_RE)];
    const plain = this.columns
      .replace(EMBED_RE, "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const result: Row = plain.includes("*")
      ? { ...row }
      : Object.fromEntries(plain.map((c) => [c, row[c] ?? null]));

    for (const [, alias, constraint] of embeds) {
      const id = row[PLAYER_FOREIGN_KEYS[constraint]];
      result[alias] = id ? (playersById.get(id) ?? null) : null;
    }

    return result;
  }

  private execute() {
    if (this.isWrite) {
      return { data: null, error: READ_ONLY_ERROR, count: null };
    }

    const source = tables[this.table];
    if (!source) {
      return {
        data: null,
        error: { message: `Unknown table: ${this.table}` },
        count: null,
      };
    }

    let rows = source.filter((row) => this.filters.every((f) => f(row)));

    if (this.orders.length > 0) {
      rows = [...rows].sort((a, b) => {
        for (const { column, ascending } of this.orders) {
          const result = compare(a[column], b[column]);
          if (result !== 0) {
            // Postgres default: NULLS LAST for asc, NULLS FIRST for desc
            return ascending ? result : -result;
          }
        }
        return 0;
      });
    }

    const count = this.countMode ? rows.length : null;
    if (this.limitCount !== null) {
      rows = rows.slice(this.offset, this.offset + this.limitCount);
    }

    if (this.headOnly) {
      return { data: null, error: null, count };
    }

    const data = rows.map((row) => this.project(row));

    if (this.singleMode) {
      if (data.length === 1) return { data: data[0], error: null, count };
      if (data.length === 0 && this.singleMode === "maybeSingle") {
        return { data: null, error: null, count };
      }
      return {
        data: null,
        error: { message: `Expected a single row, got ${data.length}` },
        count,
      };
    }

    return { data, error: null, count };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }
}

const archiveClient = {
  from: (table: string) => new QueryBuilder(table),
  rpc: async () => ({ data: null, error: READ_ONLY_ERROR }),
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithOAuth: async () => ({ data: null, error: READ_ONLY_ERROR }),
    exchangeCodeForSession: async () => ({ data: null, error: READ_ONLY_ERROR }),
    signOut: async () => ({ error: null }),
  },
};

export function createArchiveClient(): SupabaseClient {
  return archiveClient as unknown as SupabaseClient;
}
