# PD Table Tennis: Supabase backup (2026-11-10)

Source: Supabase project "pd table tennis" (ref `cushwlanffcpxttenepi`, eu-west-1, Postgres 17).

## Files
- `schema.sql`: all `public` tables, columns, defaults, primary/unique/check/foreign keys, 17 indexes,
  2 functions (`update_updated_at_column`, `is_admin`), 6 `updated_at` triggers, RLS enabled on all
  6 tables, and all 23 RLS policies.
- `data.sql`: INSERTs for every row, in foreign-key order, inside one transaction.
- `csv/*.csv`: one CSV per table (header row, empty cell = NULL).
- `pd-table-tennis-backup.zip`: everything above in one file.

## Row counts (live = backup)
| table | rows |
|---|---|
| editions | 3 |
| players | 43 |
| tournament_settings | 1 |
| users | 12 |
| edition_matches | 211 |
| elo_matches | 211 |

Verified: schema.sql + data.sql were restored into a scratch Postgres, and an MD5 checksum of every
row of every table matched the live database exactly.

## Restore into a new Supabase project
Open the SQL editor and run `schema.sql`, then `data.sql`.
`public.users.id` references `auth.users`. Since sign-in accounts aren't restored, `data.sql` adds that
foreign key as `NOT VALID`. Note: a user's new auth id will differ from the old one when they sign in
again on a new project, so their `public.users` row would need re-linking (or recreate it on first login).

## Not included / not applicable
- **Auth users (12)**: all sign in with Google OAuth, no passwords. Their id, email and name are already
  in `users.csv` (ids match `auth.users`). Supabase sessions/tokens can't be migrated; people just sign in again.
- **Storage**: 0 buckets, 0 files. Nothing to back up.
- **Edge functions**: none. **Vault secrets**: none. **pg_cron jobs / Realtime publications**: none.
- **Migrations history**: empty (schema was created via SQL editor, not the CLI).
- **Project settings** (Google OAuth client config, redirect URLs, API keys): not exportable via SQL.
  Copy the Google provider client ID and redirect URLs from Authentication > Providers if you'll need them.
- Default Supabase table grants to `anon`/`authenticated` are not in schema.sql; a new Supabase project
  applies them automatically to new tables in `public`.
