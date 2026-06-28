-- Add explicit season tracking for tournament and ELO history.

ALTER TABLE editions
  ADD COLUMN IF NOT EXISTS season INTEGER NOT NULL DEFAULT 3 CHECK (season > 0);

UPDATE editions
SET season = 3
WHERE season IS NULL;

ALTER TABLE edition_matches
  ADD COLUMN IF NOT EXISTS season INTEGER NOT NULL DEFAULT 3 CHECK (season > 0);

UPDATE edition_matches
SET season = COALESCE(
  (
    SELECT editions.season
    FROM editions
    WHERE editions.id = edition_matches.edition_id
  ),
  3
)
WHERE season IS NULL;

ALTER TABLE elo_matches
  ADD COLUMN IF NOT EXISTS season INTEGER NOT NULL DEFAULT 3 CHECK (season > 0);

UPDATE elo_matches
SET season = COALESCE(
  (
    SELECT edition_matches.season
    FROM edition_matches
    WHERE edition_matches.id = elo_matches.source_match_id
  ),
  3
)
WHERE season IS NULL;

CREATE INDEX IF NOT EXISTS idx_edition_matches_season ON edition_matches(season);
CREATE INDEX IF NOT EXISTS idx_elo_matches_season ON elo_matches(season);
