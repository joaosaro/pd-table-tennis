-- Move tournament matches into archived editions and create the ongoing ELO log.

CREATE TABLE IF NOT EXISTS editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'archived' CHECK (status IN ('active', 'archived')),
  starts_on DATE,
  ends_on DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO editions (id, name, status, archived_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'PD Table Tennis 2025',
  'archived',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE IF EXISTS matches RENAME TO edition_matches;

ALTER TABLE edition_matches
  ADD COLUMN IF NOT EXISTS edition_id UUID
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES editions(id) ON DELETE RESTRICT;

UPDATE edition_matches
SET edition_id = '00000000-0000-0000-0000-000000000001'
WHERE edition_id IS NULL;

ALTER TABLE edition_matches
  ALTER COLUMN edition_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_player1_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edition_matches_player1_id_fkey'
  ) THEN
    ALTER TABLE edition_matches
      RENAME CONSTRAINT matches_player1_id_fkey TO edition_matches_player1_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_player2_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edition_matches_player2_id_fkey'
  ) THEN
    ALTER TABLE edition_matches
      RENAME CONSTRAINT matches_player2_id_fkey TO edition_matches_player2_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_winner_id_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edition_matches_winner_id_fkey'
  ) THEN
    ALTER TABLE edition_matches
      RENAME CONSTRAINT matches_winner_id_fkey TO edition_matches_winner_id_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_recorded_by_fkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'edition_matches_recorded_by_fkey'
  ) THEN
    ALTER TABLE edition_matches
      RENAME CONSTRAINT matches_recorded_by_fkey TO edition_matches_recorded_by_fkey;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS elo_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('edition_match', 'manual')),
  source_match_id UUID REFERENCES edition_matches(id) ON DELETE SET NULL,
  player1_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  played_at TIMESTAMPTZ NOT NULL,
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

INSERT INTO elo_matches (
  source_type,
  source_match_id,
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

CREATE INDEX IF NOT EXISTS idx_edition_matches_edition ON edition_matches(edition_id);
CREATE INDEX IF NOT EXISTS idx_edition_matches_player1 ON edition_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_edition_matches_player2 ON edition_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_edition_matches_phase ON edition_matches(phase);
CREATE INDEX IF NOT EXISTS idx_edition_matches_status ON edition_matches(status);
CREATE INDEX IF NOT EXISTS idx_elo_matches_player1 ON elo_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_elo_matches_player2 ON elo_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_elo_matches_played_at ON elo_matches(played_at);

ALTER TABLE editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edition_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view matches" ON edition_matches;
DROP POLICY IF EXISTS "Editors and admins can insert matches" ON edition_matches;
DROP POLICY IF EXISTS "Editors and admins can update matches" ON edition_matches;
DROP POLICY IF EXISTS "Editors and admins can delete matches" ON edition_matches;

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

DROP TRIGGER IF EXISTS update_matches_updated_at ON edition_matches;

CREATE TRIGGER update_editions_updated_at
  BEFORE UPDATE ON editions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_edition_matches_updated_at
  BEFORE UPDATE ON edition_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_elo_matches_updated_at
  BEFORE UPDATE ON elo_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
