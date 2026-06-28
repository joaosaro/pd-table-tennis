-- Import PD Table Tennis 2024 (I edition) knockout-stage results.
--
-- Assumptions:
-- - This belongs to the existing 2024 (I edition) imported as season 1.
-- - Knockout phase dates map to the first day of each month from June to
--   September 2024 to preserve ELO ordering after the league stage.
-- - Exact per-set points are unavailable, so set columns store synthetic 1-0 /
--   0-1 markers that preserve the recorded 2-0 and 2-1 outcomes.

DO $$
DECLARE
  v_edition_id CONSTANT UUID := '00000000-0000-0000-0000-000000000101';
BEGIN
  WITH player_map AS (
    SELECT id, name
    FROM players
    WHERE name IN (
      'Felipe Ortiz',
      'Mauro Julião',
      'João Eirinha',
      'Frederico Vilarinho',
      'João Saro',
      'Tiago Mestre',
      'Diogo Correia',
      'Pedro Nogueira',
      'Daniel Moreira',
      'Eduardo Parreira',
      'Hélio',
      'Tiago Almeida'
    )
  ),
  source_matches AS (
    SELECT *
    FROM (
      VALUES
        ('João Saro', 'Pedro Nogueira', 'João Saro', 'knockout_r1', 1, TIMESTAMPTZ '2024-06-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Tiago Almeida', 'João Eirinha', 'Tiago Almeida', 'knockout_r1', 2, TIMESTAMPTZ '2024-06-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Mauro Julião', 'Eduardo Parreira', 'Eduardo Parreira', 'knockout_r1', 3, TIMESTAMPTZ '2024-06-01 00:00:00+00', 0, 1, 0, 1, NULL, NULL),
        ('Daniel Moreira', 'Tiago Mestre', 'Daniel Moreira', 'knockout_r1', 4, TIMESTAMPTZ '2024-06-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),

        ('Felipe Ortiz', 'João Saro', 'Felipe Ortiz', 'knockout_r2', 1, TIMESTAMPTZ '2024-07-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Diogo Correia', 'Tiago Almeida', 'Tiago Almeida', 'knockout_r2', 2, TIMESTAMPTZ '2024-07-01 00:00:00+00', 0, 1, 0, 1, NULL, NULL),
        ('Frederico Vilarinho', 'Eduardo Parreira', 'Eduardo Parreira', 'knockout_r2', 3, TIMESTAMPTZ '2024-07-01 00:00:00+00', 0, 1, 1, 0, 0, 1),
        ('Hélio', 'Daniel Moreira', 'Hélio', 'knockout_r2', 4, TIMESTAMPTZ '2024-07-01 00:00:00+00', 1, 0, 0, 1, 1, 0),

        ('Felipe Ortiz', 'Tiago Almeida', 'Felipe Ortiz', 'semifinal', 1, TIMESTAMPTZ '2024-08-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Eduardo Parreira', 'Hélio', 'Eduardo Parreira', 'semifinal', 2, TIMESTAMPTZ '2024-08-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),

        ('Felipe Ortiz', 'Eduardo Parreira', 'Felipe Ortiz', 'final', NULL, TIMESTAMPTZ '2024-09-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL)
    ) AS t(
      player1_name,
      player2_name,
      winner_name,
      phase,
      knockout_position,
      played_at,
      set1_p1,
      set1_p2,
      set2_p1,
      set2_p2,
      set3_p1,
      set3_p2
    )
  ),
  resolved_matches AS (
    SELECT
      v_edition_id AS edition_id,
      1 AS season,
      p1.id AS player1_id,
      p2.id AS player2_id,
      m.phase,
      'completed'::TEXT AS status,
      winner.id AS winner_id,
      m.set1_p1,
      m.set1_p2,
      m.set2_p1,
      m.set2_p2,
      m.set3_p1,
      m.set3_p2,
      m.knockout_position,
      m.played_at AS recorded_at,
      m.played_at AS created_at,
      m.played_at AS updated_at
    FROM source_matches m
    JOIN player_map p1 ON p1.name = m.player1_name
    JOIN player_map p2 ON p2.name = m.player2_name
    JOIN player_map winner ON winner.name = m.winner_name
  )
  INSERT INTO edition_matches (
    edition_id,
    season,
    player1_id,
    player2_id,
    phase,
    status,
    winner_id,
    set1_p1,
    set1_p2,
    set2_p1,
    set2_p2,
    set3_p1,
    set3_p2,
    knockout_position,
    recorded_at,
    created_at,
    updated_at
  )
  SELECT
    edition_id,
    season,
    player1_id,
    player2_id,
    phase,
    status,
    winner_id,
    set1_p1,
    set1_p2,
    set2_p1,
    set2_p2,
    set3_p1,
    set3_p2,
    knockout_position,
    recorded_at,
    created_at,
    updated_at
  FROM resolved_matches rm
  WHERE NOT EXISTS (
    SELECT 1
    FROM edition_matches existing
    WHERE existing.edition_id = rm.edition_id
      AND existing.phase = rm.phase
      AND existing.player1_id = rm.player1_id
      AND existing.player2_id = rm.player2_id
      AND existing.recorded_at = rm.recorded_at
  );

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
    created_at,
    updated_at
  )
  SELECT
    'edition_match',
    em.id,
    em.season,
    em.player1_id,
    em.player2_id,
    em.winner_id,
    COALESCE(em.recorded_at, em.created_at),
    em.set1_p1,
    em.set1_p2,
    em.set2_p1,
    em.set2_p2,
    em.set3_p1,
    em.set3_p2,
    em.created_at,
    em.updated_at
  FROM edition_matches em
  WHERE em.edition_id = v_edition_id
    AND em.phase IN ('knockout_r1', 'knockout_r2', 'semifinal', 'final')
    AND em.status = 'completed'
    AND em.winner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM elo_matches elo
      WHERE elo.source_type = 'edition_match'
        AND elo.source_match_id = em.id
    );
END $$;
