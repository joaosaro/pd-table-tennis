-- Import PD Table Tennis 2024 (I edition) group-stage results.
--
-- Assumptions:
-- - This is season 1.
-- - Round dates map to the first day of each month from January to May 2024.
-- - Exact per-set points are unavailable, so set columns store synthetic 1-0 / 0-1
--   markers that preserve the recorded 2-0 and 2-1 outcomes.

DO $$
DECLARE
  v_edition_id CONSTANT UUID := '00000000-0000-0000-0000-000000000101';
BEGIN
  INSERT INTO editions (
    id,
    name,
    season,
    status,
    starts_on,
    ends_on,
    archived_at
  )
  VALUES (
    v_edition_id,
    'PD Table Tennis 2024 (I edition)',
    1,
    'archived',
    DATE '2024-01-01',
    DATE '2024-05-31',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    season = EXCLUDED.season,
    status = EXCLUDED.status,
    starts_on = EXCLUDED.starts_on,
    ends_on = EXCLUDED.ends_on;

  WITH player_map AS (
    SELECT id, name
    FROM players
    WHERE name IN (
      'Felipe Ortiz',
      'Mauro Julião',
      'João Guerreiro',
      'João Eirinha',
      'Frederico Vilarinho',
      'João Rosa',
      'Santos',
      'João Saro',
      'Tiago Mestre',
      'Gonçalo Rações',
      'Beatriz Pires',
      'Diogo Correia',
      'Pedro Nogueira',
      'Daniel Moreira',
      'Eduardo Parreira',
      'Karina Freitas',
      'Hélio',
      'Tiago Almeida',
      'Ângela Fernandes'
    )
  ),
  source_matches AS (
    SELECT *
    FROM (
      VALUES
        ('Felipe Ortiz', 'Mauro Julião', 'Felipe Ortiz', TIMESTAMPTZ '2024-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Felipe Ortiz', 'João Guerreiro', 'Felipe Ortiz', TIMESTAMPTZ '2024-02-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Mauro Julião', 'João Guerreiro', 'Mauro Julião', TIMESTAMPTZ '2024-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Mauro Julião', 'João Eirinha', 'Mauro Julião', TIMESTAMPTZ '2024-04-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('João Eirinha', 'João Guerreiro', 'João Eirinha', TIMESTAMPTZ '2024-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),

        ('Frederico Vilarinho', 'João Rosa', 'Frederico Vilarinho', TIMESTAMPTZ '2024-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Tiago Mestre', 'Santos', 'Tiago Mestre', TIMESTAMPTZ '2024-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('João Saro', 'Santos', 'João Saro', TIMESTAMPTZ '2024-02-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Frederico Vilarinho', 'Tiago Mestre', 'Frederico Vilarinho', TIMESTAMPTZ '2024-02-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('João Saro', 'Tiago Mestre', 'João Saro', TIMESTAMPTZ '2024-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Santos', 'João Rosa', 'Santos', TIMESTAMPTZ '2024-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Tiago Mestre', 'João Rosa', 'Tiago Mestre', TIMESTAMPTZ '2024-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Frederico Vilarinho', 'João Saro', 'Frederico Vilarinho', TIMESTAMPTZ '2024-04-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Frederico Vilarinho', 'Santos', 'Frederico Vilarinho', TIMESTAMPTZ '2024-05-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('João Saro', 'João Rosa', 'João Saro', TIMESTAMPTZ '2024-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),

        ('Gonçalo Rações', 'Beatriz Pires', 'Gonçalo Rações', TIMESTAMPTZ '2024-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Diogo Correia', 'Pedro Nogueira', 'Diogo Correia', TIMESTAMPTZ '2024-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Diogo Correia', 'Beatriz Pires', 'Diogo Correia', TIMESTAMPTZ '2024-02-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Daniel Moreira', 'Pedro Nogueira', 'Daniel Moreira', TIMESTAMPTZ '2024-02-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Pedro Nogueira', 'Beatriz Pires', 'Pedro Nogueira', TIMESTAMPTZ '2024-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Gonçalo Rações', 'Daniel Moreira', 'Gonçalo Rações', TIMESTAMPTZ '2024-03-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Diogo Correia', 'Gonçalo Rações', 'Diogo Correia', TIMESTAMPTZ '2024-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Daniel Moreira', 'Beatriz Pires', 'Daniel Moreira', TIMESTAMPTZ '2024-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Pedro Nogueira', 'Gonçalo Rações', 'Pedro Nogueira', TIMESTAMPTZ '2024-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Diogo Correia', 'Daniel Moreira', 'Diogo Correia', TIMESTAMPTZ '2024-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),

        ('Eduardo Parreira', 'Karina Freitas', 'Eduardo Parreira', TIMESTAMPTZ '2024-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Hélio', 'Tiago Almeida', 'Hélio', TIMESTAMPTZ '2024-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Tiago Almeida', 'Karina Freitas', 'Tiago Almeida', TIMESTAMPTZ '2024-02-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Hélio', 'Ângela Fernandes', 'Hélio', TIMESTAMPTZ '2024-02-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Hélio', 'Karina Freitas', 'Hélio', TIMESTAMPTZ '2024-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Eduardo Parreira', 'Ângela Fernandes', 'Eduardo Parreira', TIMESTAMPTZ '2024-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Tiago Almeida', 'Eduardo Parreira', 'Tiago Almeida', TIMESTAMPTZ '2024-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Karina Freitas', 'Ângela Fernandes', 'Karina Freitas', TIMESTAMPTZ '2024-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Hélio', 'Eduardo Parreira', 'Hélio', TIMESTAMPTZ '2024-05-01 00:00:00+00', 1, 0, 0, 1, 1, 0)
    ) AS t(
      player1_name,
      player2_name,
      winner_name,
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
      'league'::TEXT AS phase,
      'completed'::TEXT AS status,
      winner.id AS winner_id,
      m.set1_p1,
      m.set1_p2,
      m.set2_p1,
      m.set2_p2,
      m.set3_p1,
      m.set3_p2,
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
    AND em.status = 'completed'
    AND em.winner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM elo_matches elo
      WHERE elo.source_type = 'edition_match'
        AND elo.source_match_id = em.id
    );
END $$;
