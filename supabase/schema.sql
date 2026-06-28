-- PD Table Tennis Tournament Schema
-- Run this in Supabase SQL Editor

-- Players (tournament participants)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  department TEXT,
  slack_handle TEXT,
  tier INTEGER NOT NULL DEFAULT 4 CHECK (tier >= 1 AND tier <= 4),
  disabled BOOLEAN NOT NULL DEFAULT false,
  disqualified_from_qualification BOOLEAN NOT NULL DEFAULT false,
  disqualification_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS disqualified_from_qualification BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS disqualification_note TEXT;

-- Users (authenticated app users, linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournament editions. Historical editions stay here; ongoing ratings live in elo_matches.
CREATE TABLE IF NOT EXISTS editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season INTEGER NOT NULL DEFAULT 3 CHECK (season > 0),
  status TEXT NOT NULL DEFAULT 'archived' CHECK (status IN ('active', 'archived')),
  starts_on DATE,
  ends_on DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the current archived edition for existing tournament matches.
INSERT INTO editions (id, name, season, status, archived_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'PD Table Tennis 2025',
  3,
  'archived',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Tournament settings (singleton table - only one row allowed)
CREATE TABLE IF NOT EXISTS tournament_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'PD Table Tennis',
  league_deadline DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tournament settings
INSERT INTO tournament_settings (id, name)
VALUES (1, 'PD Table Tennis')
ON CONFLICT (id) DO NOTHING;

-- Edition-scoped tournament matches
CREATE TABLE IF NOT EXISTS edition_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES editions(id) ON DELETE RESTRICT,
  season INTEGER NOT NULL DEFAULT 3 CHECK (season > 0),
  player1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('league', 'knockout_r1', 'knockout_r2', 'semifinal', 'final')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed')),
  winner_id UUID REFERENCES players(id) ON DELETE SET NULL,
  -- Set scores (best of 3)
  set1_p1 INTEGER,
  set1_p2 INTEGER,
  set2_p1 INTEGER,
  set2_p2 INTEGER,
  set3_p1 INTEGER,
  set3_p2 INTEGER,
  -- Knockout specific
  knockout_position INTEGER,
  -- Audit
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_players CHECK (player1_id != player2_id)
);

-- Ongoing ELO event log. This is the canonical source for ratings.
CREATE TABLE IF NOT EXISTS elo_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('edition_match', 'manual')),
  source_match_id UUID REFERENCES edition_matches(id) ON DELETE SET NULL,
  season INTEGER NOT NULL DEFAULT 3 CHECK (season > 0),
  player1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL,
  -- Optional set scores (best of 3 when available)
  set1_p1 INTEGER,
  set1_p2 INTEGER,
  set2_p1 INTEGER,
  set2_p2 INTEGER,
  set3_p1 INTEGER,
  set3_p2 INTEGER,
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT elo_different_players CHECK (player1_id != player2_id),
  CONSTRAINT elo_winner_is_player CHECK (winner_id IN (player1_id, player2_id)),
  CONSTRAINT elo_manual_source_match_empty CHECK (
    source_type != 'manual' OR source_match_id IS NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_elo_matches_source_match
  ON elo_matches(source_match_id)
  WHERE source_type = 'edition_match';

-- Backfill ELO events from completed edition matches.
INSERT INTO elo_matches (
  source_type,
  source_match_id,
  season,
  player1_id,
  player2_id,
  winner_id,
  played_at,
  set1_p1,
  set1_p2,
  set2_p1,
  set2_p2,
  set3_p1,
  set3_p2,
  recorded_by,
  created_at,
  updated_at
)
SELECT
  'edition_match',
  id,
  season,
  player1_id,
  player2_id,
  winner_id,
  COALESCE(recorded_at, created_at),
  set1_p1,
  set1_p2,
  set2_p1,
  set2_p2,
  set3_p1,
  set3_p2,
  recorded_by,
  created_at,
  updated_at
FROM edition_matches
WHERE status = 'completed'
  AND winner_id IS NOT NULL
ON CONFLICT (source_match_id) WHERE source_type = 'edition_match' DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_edition_matches_edition ON edition_matches(edition_id);
CREATE INDEX IF NOT EXISTS idx_edition_matches_season ON edition_matches(season);
CREATE INDEX IF NOT EXISTS idx_edition_matches_player1 ON edition_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_edition_matches_player2 ON edition_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_edition_matches_phase ON edition_matches(phase);
CREATE INDEX IF NOT EXISTS idx_edition_matches_status ON edition_matches(status);
CREATE INDEX IF NOT EXISTS idx_elo_matches_player1 ON elo_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_elo_matches_player2 ON elo_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_elo_matches_season ON elo_matches(season);
CREATE INDEX IF NOT EXISTS idx_elo_matches_played_at ON elo_matches(played_at);
CREATE INDEX IF NOT EXISTS idx_players_tier ON players(tier);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_slack_handle ON players(slack_handle);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edition_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Players: Public read, Admin write
CREATE POLICY "Anyone can view players" ON players
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert players" ON players
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update players" ON players
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete players" ON players
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users: Self read, Admin manage
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update users" ON users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Allow insert on first login" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Editions: Public read, Admin write
CREATE POLICY "Anyone can view editions" ON editions
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert editions" ON editions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update editions" ON editions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete editions" ON editions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Edition matches: Public read, Editor+ write
CREATE POLICY "Anyone can view edition matches" ON edition_matches
  FOR SELECT USING (true);

CREATE POLICY "Editors and admins can insert edition matches" ON edition_matches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Editors and admins can update edition matches" ON edition_matches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Editors and admins can delete edition matches" ON edition_matches
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- ELO matches: Public read, Editor+ write
CREATE POLICY "Anyone can view elo matches" ON elo_matches
  FOR SELECT USING (true);

CREATE POLICY "Editors and admins can insert elo matches" ON elo_matches
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Editors and admins can update elo matches" ON elo_matches
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Editors and admins can delete elo matches" ON elo_matches
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- Tournament settings: Public read, Admin write
CREATE POLICY "Anyone can view tournament settings" ON tournament_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update tournament settings" ON tournament_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_editions_updated_at
  BEFORE UPDATE ON editions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_edition_matches_updated_at
  BEFORE UPDATE ON edition_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_elo_matches_updated_at
  BEFORE UPDATE ON elo_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_settings_updated_at
  BEFORE UPDATE ON tournament_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
