-- PD Table Tennis: Supabase schema backup
-- Source project: "pd table tennis" (ref cushwlanffcpxttenepi), Postgres 17
-- Exported 2026-11-10 via Supabase connector.
-- Restore order: schema.sql, then data.sql. Intended for a fresh Supabase project
-- (relies on Supabase's auth schema, auth.uid(), and the pgcrypto extension).
-- Migrations list: none recorded in supabase_migrations (schema was created outside the CLI).
-- Edge functions: none. Storage buckets: none. Vault secrets: none. Views/enums/sequences: none.

SET search_path = public, extensions;

-- Extensions in use (all pre-installed on new Supabase projects)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- =========================== Tables ===========================
CREATE TABLE public.edition_matches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  player1_id uuid NOT NULL,
  player2_id uuid NOT NULL,
  phase text NOT NULL,
  status text DEFAULT 'scheduled'::text NOT NULL,
  winner_id uuid,
  set1_p1 integer,
  set1_p2 integer,
  set2_p1 integer,
  set2_p2 integer,
  set3_p1 integer,
  set3_p2 integer,
  knockout_position integer,
  recorded_by uuid,
  recorded_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  edition_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
  season integer DEFAULT 3 NOT NULL
);

CREATE TABLE public.editions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'archived'::text NOT NULL,
  starts_on date,
  ends_on date,
  archived_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  season integer DEFAULT 3 NOT NULL
);

CREATE TABLE public.elo_matches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  source_type text DEFAULT 'manual'::text NOT NULL,
  source_match_id uuid,
  player1_id uuid NOT NULL,
  player2_id uuid NOT NULL,
  winner_id uuid NOT NULL,
  played_at timestamp with time zone NOT NULL,
  set1_p1 integer,
  set1_p2 integer,
  set2_p1 integer,
  set2_p2 integer,
  set3_p1 integer,
  set3_p2 integer,
  notes text,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  season integer DEFAULT 3 NOT NULL
);

CREATE TABLE public.players (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  department text,
  tier integer DEFAULT 4 NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  slack_handle text,
  disqualified_from_qualification boolean DEFAULT false NOT NULL,
  disqualification_note text,
  disabled boolean DEFAULT false NOT NULL
);

CREATE TABLE public.tournament_settings (
  id integer DEFAULT 1 NOT NULL,
  name text DEFAULT 'PD Table Tennis'::text NOT NULL,
  league_deadline date,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text DEFAULT 'viewer'::text NOT NULL,
  player_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ===================== Primary keys, unique, check =====================
ALTER TABLE public.edition_matches ADD CONSTRAINT matches_pkey PRIMARY KEY (id);
ALTER TABLE public.edition_matches ADD CONSTRAINT different_players CHECK ((player1_id <> player2_id));
ALTER TABLE public.edition_matches ADD CONSTRAINT edition_matches_season_check CHECK ((season > 0));
ALTER TABLE public.edition_matches ADD CONSTRAINT matches_phase_check CHECK ((phase = ANY (ARRAY['league'::text, 'knockout_r1'::text, 'knockout_r2'::text, 'semifinal'::text, 'final'::text])));
ALTER TABLE public.edition_matches ADD CONSTRAINT matches_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text])));
ALTER TABLE public.editions ADD CONSTRAINT editions_pkey PRIMARY KEY (id);
ALTER TABLE public.editions ADD CONSTRAINT editions_season_check CHECK ((season > 0));
ALTER TABLE public.editions ADD CONSTRAINT editions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])));
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_matches_pkey PRIMARY KEY (id);
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_different_players CHECK ((player1_id <> player2_id));
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_manual_source_match_empty CHECK (((source_type <> 'manual'::text) OR (source_match_id IS NULL)));
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_matches_season_check CHECK ((season > 0));
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_matches_source_type_check CHECK ((source_type = ANY (ARRAY['edition_match'::text, 'manual'::text])));
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_winner_is_player CHECK (((winner_id = player1_id) OR (winner_id = player2_id)));
ALTER TABLE public.players ADD CONSTRAINT players_pkey PRIMARY KEY (id);
ALTER TABLE public.players ADD CONSTRAINT players_tier_check CHECK (((tier >= 1) AND (tier <= 4)));
ALTER TABLE public.tournament_settings ADD CONSTRAINT tournament_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.tournament_settings ADD CONSTRAINT tournament_settings_id_check CHECK ((id = 1));
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'editor'::text, 'viewer'::text])));

-- =========================== Foreign keys ===========================
ALTER TABLE public.edition_matches ADD CONSTRAINT edition_matches_edition_id_fkey FOREIGN KEY (edition_id) REFERENCES public.editions(id) ON DELETE RESTRICT;
ALTER TABLE public.edition_matches ADD CONSTRAINT edition_matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.edition_matches ADD CONSTRAINT edition_matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.edition_matches ADD CONSTRAINT edition_matches_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.edition_matches ADD CONSTRAINT edition_matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.players(id) ON DELETE SET NULL;
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_matches_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_matches_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES public.players(id) ON DELETE CASCADE;
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_matches_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_matches_source_match_id_fkey FOREIGN KEY (source_match_id) REFERENCES public.edition_matches(id) ON DELETE SET NULL;
ALTER TABLE public.elo_matches ADD CONSTRAINT elo_matches_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.players(id) ON DELETE CASCADE;
-- public.users.id -> auth.users(id) ON DELETE CASCADE (users_id_fkey) is added at the END of
-- data.sql (as NOT VALID), because on a new project the auth users won't exist yet.
ALTER TABLE public.users ADD CONSTRAINT users_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE SET NULL;

-- ============================= Indexes =============================
CREATE INDEX idx_matches_status ON public.edition_matches USING btree (status);
CREATE INDEX idx_edition_matches_status ON public.edition_matches USING btree (status);
CREATE INDEX idx_edition_matches_phase ON public.edition_matches USING btree (phase);
CREATE INDEX idx_matches_phase ON public.edition_matches USING btree (phase);
CREATE INDEX idx_edition_matches_edition ON public.edition_matches USING btree (edition_id);
CREATE INDEX idx_edition_matches_player2 ON public.edition_matches USING btree (player2_id);
CREATE INDEX idx_matches_player2 ON public.edition_matches USING btree (player2_id);
CREATE INDEX idx_matches_player1 ON public.edition_matches USING btree (player1_id);
CREATE INDEX idx_edition_matches_season ON public.edition_matches USING btree (season);
CREATE INDEX idx_edition_matches_player1 ON public.edition_matches USING btree (player1_id);
CREATE INDEX idx_elo_matches_player2 ON public.elo_matches USING btree (player2_id);
CREATE INDEX idx_elo_matches_season ON public.elo_matches USING btree (season);
CREATE INDEX idx_elo_matches_player1 ON public.elo_matches USING btree (player1_id);
CREATE INDEX idx_elo_matches_played_at ON public.elo_matches USING btree (played_at);
CREATE UNIQUE INDEX idx_elo_matches_source_match ON public.elo_matches USING btree (source_match_id) WHERE (source_type = 'edition_match'::text);
CREATE UNIQUE INDEX idx_players_slack_handle ON public.players USING btree (slack_handle);
CREATE INDEX idx_players_tier ON public.players USING btree (tier);

-- ============================ Functions ============================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
  BEGIN
    RETURN EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    );
  END;
  $function$;

-- ============================= Triggers =============================
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tournament_settings_updated_at BEFORE UPDATE ON public.tournament_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_editions_updated_at BEFORE UPDATE ON public.editions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_edition_matches_updated_at BEFORE UPDATE ON public.edition_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_elo_matches_updated_at BEFORE UPDATE ON public.elo_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ======================= Row Level Security =======================
ALTER TABLE public.edition_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elo_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and editors can insert matches" ON public.edition_matches AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'editor'::text]))))));
CREATE POLICY "Anyone can view edition matches" ON public.edition_matches AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Editors and admins can delete edition matches" ON public.edition_matches AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'editor'::text]))))));
CREATE POLICY "Editors and admins can insert edition matches" ON public.edition_matches AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'editor'::text]))))));
CREATE POLICY "Editors and admins can update edition matches" ON public.edition_matches AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'editor'::text]))))));
CREATE POLICY "Admins can delete editions" ON public.editions AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Admins can insert editions" ON public.editions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Admins can update editions" ON public.editions AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Anyone can view editions" ON public.editions AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can view elo matches" ON public.elo_matches AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Editors and admins can delete elo matches" ON public.elo_matches AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'editor'::text]))))));
CREATE POLICY "Editors and admins can insert elo matches" ON public.elo_matches AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'editor'::text]))))));
CREATE POLICY "Editors and admins can update elo matches" ON public.elo_matches AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'editor'::text]))))));
CREATE POLICY "Admins can delete players" ON public.players AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Admins can insert players" ON public.players AS PERMISSIVE FOR INSERT TO public WITH CHECK ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Admins can update players" ON public.players AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Anyone can view players" ON public.players AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can update tournament settings" ON public.tournament_settings AS PERMISSIVE FOR UPDATE TO public USING ((EXISTS ( SELECT 1 FROM users WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
CREATE POLICY "Anyone can view tournament settings" ON public.tournament_settings AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Admins can update users" ON public.users AS PERMISSIVE FOR UPDATE TO public USING (is_admin());
CREATE POLICY "Admins can view all users" ON public.users AS PERMISSIVE FOR SELECT TO public USING (is_admin());
CREATE POLICY "Allow insert on first login" ON public.users AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can view own profile" ON public.users AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));
