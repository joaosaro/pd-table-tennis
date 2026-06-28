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

-- Tournament editions. Historical editions stay here; Elo ratings are rebuilt from edition_matches.
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

-- Legacy ELO event log kept for compatibility with older imports.
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

-- Current ELO rating per player.
CREATE TABLE IF NOT EXISTS player_elo_ratings (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_rating NUMERIC(10,4) NOT NULL,
  initial_rating NUMERIC(10,4) NOT NULL,
  rated_games INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  last_match_id UUID REFERENCES edition_matches(id) ON DELETE SET NULL,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-player ELO history for every rated match.
CREATE TABLE IF NOT EXISTS elo_rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES edition_matches(id) ON DELETE CASCADE,
  season INTEGER NOT NULL CHECK (season > 0),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL,
  result_score NUMERIC(3,1) NOT NULL CHECK (result_score IN (0, 0.5, 1)),
  expected_score NUMERIC(12,8) NOT NULL,
  k_factor INTEGER NOT NULL CHECK (k_factor > 0),
  rated_games_before INTEGER NOT NULL DEFAULT 0,
  rated_games_after INTEGER NOT NULL DEFAULT 0,
  rating_before NUMERIC(10,4) NOT NULL,
  rating_after NUMERIC(10,4) NOT NULL,
  rating_change NUMERIC(10,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT elo_rating_history_unique_match_player UNIQUE (match_id, player_id),
  CONSTRAINT elo_rating_history_different_players CHECK (player_id != opponent_id)
);

CREATE INDEX IF NOT EXISTS idx_player_elo_ratings_last_played
  ON player_elo_ratings(last_played_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_elo_rating_history_player
  ON elo_rating_history(player_id, played_at DESC, match_id);
CREATE INDEX IF NOT EXISTS idx_elo_rating_history_match
  ON elo_rating_history(match_id);
CREATE INDEX IF NOT EXISTS idx_elo_rating_history_played_at
  ON elo_rating_history(played_at);

DO $$
DECLARE
  match_record RECORD;
  player1_state RECORD;
  player2_state RECORD;
  player1_score NUMERIC(3,1);
  player2_score NUMERIC(3,1);
  player1_expected NUMERIC(12,8);
  player2_expected NUMERIC(12,8);
  player1_k INTEGER;
  player2_k INTEGER;
  player1_next NUMERIC(10,4);
  player2_next NUMERIC(10,4);
  lowest_active_starting_rating NUMERIC(10,4);
  lowest_active_rating NUMERIC(10,4);
  starting_rating NUMERIC(10,4);
BEGIN
  DELETE FROM elo_rating_history;
  DELETE FROM player_elo_ratings;

  CREATE TEMP TABLE tmp_elo_state (
    player_id UUID PRIMARY KEY,
    rating NUMERIC(10,4),
    initial_rating NUMERIC(10,4),
    rated_games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    last_match_id UUID,
    last_played_at TIMESTAMPTZ,
    initialized BOOLEAN NOT NULL DEFAULT false
  ) ON COMMIT DROP;

  INSERT INTO tmp_elo_state (player_id)
  SELECT id
  FROM players;

  UPDATE tmp_elo_state
  SET
    rating = 1000,
    initial_rating = 1000,
    initialized = true
  WHERE player_id IN (
    SELECT DISTINCT player_id
    FROM (
      SELECT player1_id AS player_id
      FROM edition_matches
      WHERE status = 'completed'
        AND winner_id IS NOT NULL
        AND season = 1
      UNION
      SELECT player2_id AS player_id
      FROM edition_matches
      WHERE status = 'completed'
        AND winner_id IS NOT NULL
        AND season = 1
    ) season_one_players
  );

  FOR match_record IN
    SELECT
      id,
      season,
      player1_id,
      player2_id,
      winner_id,
      COALESCE(recorded_at, created_at) AS played_at,
      created_at
    FROM edition_matches
    WHERE status = 'completed'
      AND winner_id IS NOT NULL
    ORDER BY COALESCE(recorded_at, created_at), created_at, id
  LOOP
    IF EXISTS (
      SELECT 1
      FROM tmp_elo_state
      WHERE player_id = match_record.player1_id
        AND initialized = false
    ) THEN
      SELECT MIN(tmp.rating)
      INTO lowest_active_starting_rating
      FROM tmp_elo_state tmp
      JOIN players ON players.id = tmp.player_id
      WHERE tmp.initialized = true
        AND players.disabled = false;

      starting_rating := CASE
        WHEN lowest_active_starting_rating IS NULL THEN 1000
        ELSE GREATEST(600, lowest_active_starting_rating - 100)
      END;

      UPDATE tmp_elo_state
      SET
        rating = starting_rating,
        initial_rating = starting_rating,
        initialized = true
      WHERE player_id = match_record.player1_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM tmp_elo_state
      WHERE player_id = match_record.player2_id
        AND initialized = false
    ) THEN
      SELECT MIN(tmp.rating)
      INTO lowest_active_starting_rating
      FROM tmp_elo_state tmp
      JOIN players ON players.id = tmp.player_id
      WHERE tmp.initialized = true
        AND players.disabled = false;

      starting_rating := CASE
        WHEN lowest_active_starting_rating IS NULL THEN 1000
        ELSE GREATEST(600, lowest_active_starting_rating - 100)
      END;

      UPDATE tmp_elo_state
      SET
        rating = starting_rating,
        initial_rating = starting_rating,
        initialized = true
      WHERE player_id = match_record.player2_id;
    END IF;

    SELECT *
    INTO player1_state
    FROM tmp_elo_state
    WHERE player_id = match_record.player1_id;

    SELECT *
    INTO player2_state
    FROM tmp_elo_state
    WHERE player_id = match_record.player2_id;

    player1_score := CASE WHEN match_record.winner_id = match_record.player1_id THEN 1 ELSE 0 END;
    player2_score := CASE WHEN match_record.winner_id = match_record.player2_id THEN 1 ELSE 0 END;

    player1_expected :=
      1 / (1 + POWER(10, ((player2_state.rating - player1_state.rating) / 400.0)));
    player2_expected :=
      1 / (1 + POWER(10, ((player1_state.rating - player2_state.rating) / 400.0)));

    player1_k := CASE
      WHEN player1_state.rated_games <= 5 THEN 80
      WHEN player1_state.rated_games <= 15 THEN 64
      WHEN player1_state.rated_games <= 30 THEN 48
      ELSE 32
    END;

    player2_k := CASE
      WHEN player2_state.rated_games <= 5 THEN 80
      WHEN player2_state.rated_games <= 15 THEN 64
      WHEN player2_state.rated_games <= 30 THEN 48
      ELSE 32
    END;

    player1_next :=
      player1_state.rating + (player1_k * (player1_score - player1_expected));
    player2_next :=
      player2_state.rating + (player2_k * (player2_score - player2_expected));

    INSERT INTO elo_rating_history (
      match_id,
      season,
      player_id,
      opponent_id,
      played_at,
      result_score,
      expected_score,
      k_factor,
      rated_games_before,
      rated_games_after,
      rating_before,
      rating_after,
      rating_change
    )
    VALUES
      (
        match_record.id,
        match_record.season,
        match_record.player1_id,
        match_record.player2_id,
        match_record.played_at,
        player1_score,
        player1_expected,
        player1_k,
        player1_state.rated_games,
        player1_state.rated_games + 1,
        player1_state.rating,
        player1_next,
        player1_next - player1_state.rating
      ),
      (
        match_record.id,
        match_record.season,
        match_record.player2_id,
        match_record.player1_id,
        match_record.played_at,
        player2_score,
        player2_expected,
        player2_k,
        player2_state.rated_games,
        player2_state.rated_games + 1,
        player2_state.rating,
        player2_next,
        player2_next - player2_state.rating
      );

    UPDATE tmp_elo_state
    SET
      rating = player1_next,
      rated_games = rated_games + 1,
      wins = wins + CASE WHEN player1_score = 1 THEN 1 ELSE 0 END,
      losses = losses + CASE WHEN player1_score = 0 THEN 1 ELSE 0 END,
      last_match_id = match_record.id,
      last_played_at = match_record.played_at
    WHERE player_id = match_record.player1_id;

    UPDATE tmp_elo_state
    SET
      rating = player2_next,
      rated_games = rated_games + 1,
      wins = wins + CASE WHEN player2_score = 1 THEN 1 ELSE 0 END,
      losses = losses + CASE WHEN player2_score = 0 THEN 1 ELSE 0 END,
      last_match_id = match_record.id,
      last_played_at = match_record.played_at
    WHERE player_id = match_record.player2_id;
  END LOOP;

  SELECT MIN(tmp.rating)
  INTO lowest_active_rating
  FROM tmp_elo_state tmp
  JOIN players ON players.id = tmp.player_id
  WHERE tmp.initialized = true
    AND players.disabled = false;

  starting_rating := CASE
    WHEN lowest_active_rating IS NULL THEN 1000
    ELSE GREATEST(600, lowest_active_rating - 100)
  END;

  UPDATE tmp_elo_state
  SET
    rating = starting_rating,
    initial_rating = starting_rating,
    initialized = true
  WHERE initialized = false;

  INSERT INTO player_elo_ratings (
    player_id,
    current_rating,
    initial_rating,
    rated_games,
    wins,
    losses,
    last_match_id,
    last_played_at
  )
  SELECT
    player_id,
    rating,
    initial_rating,
    rated_games,
    wins,
    losses,
    last_match_id,
    last_played_at
  FROM tmp_elo_state;
END $$;
CREATE INDEX IF NOT EXISTS idx_players_tier ON players(tier);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_slack_handle ON players(slack_handle);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edition_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_elo_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_rating_history ENABLE ROW LEVEL SECURITY;
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

-- Player ELO ratings: Public read, Editor+ write
CREATE POLICY "Anyone can view player elo ratings" ON player_elo_ratings
  FOR SELECT USING (true);

CREATE POLICY "Editors and admins can insert player elo ratings" ON player_elo_ratings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Editors and admins can update player elo ratings" ON player_elo_ratings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Editors and admins can delete player elo ratings" ON player_elo_ratings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

-- ELO rating history: Public read, Editor+ write
CREATE POLICY "Anyone can view elo rating history" ON elo_rating_history
  FOR SELECT USING (true);

CREATE POLICY "Editors and admins can insert elo rating history" ON elo_rating_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Editors and admins can update elo rating history" ON elo_rating_history
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'editor'))
  );

CREATE POLICY "Editors and admins can delete elo rating history" ON elo_rating_history
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

CREATE TRIGGER update_player_elo_ratings_updated_at
  BEFORE UPDATE ON player_elo_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_settings_updated_at
  BEFORE UPDATE ON tournament_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
