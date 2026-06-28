-- Replace the fixed-K ELO projection with persistent current ratings and
-- per-match ELO history derived from edition_matches.

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

ALTER TABLE player_elo_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_rating_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view player elo ratings" ON player_elo_ratings;
DROP POLICY IF EXISTS "Editors and admins can insert player elo ratings" ON player_elo_ratings;
DROP POLICY IF EXISTS "Editors and admins can update player elo ratings" ON player_elo_ratings;
DROP POLICY IF EXISTS "Editors and admins can delete player elo ratings" ON player_elo_ratings;

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

DROP POLICY IF EXISTS "Anyone can view elo rating history" ON elo_rating_history;
DROP POLICY IF EXISTS "Editors and admins can insert elo rating history" ON elo_rating_history;
DROP POLICY IF EXISTS "Editors and admins can update elo rating history" ON elo_rating_history;
DROP POLICY IF EXISTS "Editors and admins can delete elo rating history" ON elo_rating_history;

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

DROP TRIGGER IF EXISTS update_player_elo_ratings_updated_at ON player_elo_ratings;
CREATE TRIGGER update_player_elo_ratings_updated_at
  BEFORE UPDATE ON player_elo_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
