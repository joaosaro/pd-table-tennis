-- Import PD Table Tennis 2025 (II edition) group-stage results.
--
-- Assumptions:
-- - This is season 2.
-- - Round dates map to the first day of each month from January to July 2025.
-- - Exact per-set points are unavailable, so set columns store synthetic 1-0 /
--   0-1 markers that preserve the recorded 2-0 and 2-1 outcomes.
-- - Invitation labels map to the corresponding existing player rows.

DO $$
DECLARE
  v_edition_id CONSTANT UUID := '00000000-0000-0000-0000-000000000102';
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
    'PD Table Tennis 2025 (II edition)',
    2,
    'archived',
    DATE '2025-01-01',
    DATE '2025-07-31',
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
      'Paulo Cabo',
      'Xan Silva',
      'Leonardo Oleirinha',
      'Marcelo Lemos',
      'Mateus Quintanilha',
      'Rita Martins',
      'Felipe Ortiz',
      'Greg Rogan',
      'João Gomes',
      'Rafael Cerca',
      'Santos',
      'João Saro',
      'Eduardo Parreira',
      'Yevheniy Kushnirenko',
      'Pedro Nogueira',
      'Ângela Fernandes',
      'Sergiu Manic',
      'Tiago Mestre',
      'Karina Freitas',
      'João Espírito Santo',
      'Hélio',
      'Peter Crorkan Ritchie',
      'Frederico Vilarinho',
      'Daniel Moreira',
      'Carina Meireles',
      'Bruno Pereira',
      'Mauro Julião'
    )
  ),
  source_matches AS (
    SELECT *
    FROM (
      VALUES
        ('Xan Silva', 'Paulo Cabo', 'Xan Silva', TIMESTAMPTZ '2025-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Marcelo Lemos', 'Mateus Quintanilha', 'Marcelo Lemos', TIMESTAMPTZ '2025-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Felipe Ortiz', 'Paulo Cabo', 'Felipe Ortiz', TIMESTAMPTZ '2025-02-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Felipe Ortiz', 'Leonardo Oleirinha', 'Felipe Ortiz', TIMESTAMPTZ '2025-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Xan Silva', 'Mateus Quintanilha', 'Xan Silva', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Felipe Ortiz', 'Marcelo Lemos', 'Felipe Ortiz', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Paulo Cabo', 'Leonardo Oleirinha', 'Paulo Cabo', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Paulo Cabo', 'Marcelo Lemos', 'Paulo Cabo', TIMESTAMPTZ '2025-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Felipe Ortiz', 'Mateus Quintanilha', 'Felipe Ortiz', TIMESTAMPTZ '2025-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Paulo Cabo', 'Mateus Quintanilha', 'Paulo Cabo', TIMESTAMPTZ '2025-06-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Marcelo Lemos', 'Leonardo Oleirinha', 'Marcelo Lemos', TIMESTAMPTZ '2025-06-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Leonardo Oleirinha', 'Mateus Quintanilha', 'Leonardo Oleirinha', TIMESTAMPTZ '2025-07-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Felipe Ortiz', 'Xan Silva', 'Felipe Ortiz', TIMESTAMPTZ '2025-07-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),

        ('Rafael Cerca', 'Santos', 'Rafael Cerca', TIMESTAMPTZ '2025-01-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('João Saro', 'Yevheniy Kushnirenko', 'João Saro', TIMESTAMPTZ '2025-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Greg Rogan', 'Eduardo Parreira', 'Greg Rogan', TIMESTAMPTZ '2025-02-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Eduardo Parreira', 'Rafael Cerca', 'Eduardo Parreira', TIMESTAMPTZ '2025-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('João Saro', 'João Gomes', 'João Saro', TIMESTAMPTZ '2025-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Santos', 'Yevheniy Kushnirenko', 'Santos', TIMESTAMPTZ '2025-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('João Gomes', 'Yevheniy Kushnirenko', 'João Gomes', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Eduardo Parreira', 'João Saro', 'Eduardo Parreira', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Greg Rogan', 'Rafael Cerca', 'Greg Rogan', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Greg Rogan', 'João Saro', 'Greg Rogan', TIMESTAMPTZ '2025-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Santos', 'João Gomes', 'Santos', TIMESTAMPTZ '2025-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Eduardo Parreira', 'Santos', 'Eduardo Parreira', TIMESTAMPTZ '2025-06-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Greg Rogan', 'Yevheniy Kushnirenko', 'Greg Rogan', TIMESTAMPTZ '2025-06-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('João Saro', 'Rafael Cerca', 'João Saro', TIMESTAMPTZ '2025-06-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Yevheniy Kushnirenko', 'Rafael Cerca', 'Yevheniy Kushnirenko', TIMESTAMPTZ '2025-07-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Greg Rogan', 'Santos', 'Greg Rogan', TIMESTAMPTZ '2025-07-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),

        ('Pedro Nogueira', 'Ângela Fernandes', 'Pedro Nogueira', TIMESTAMPTZ '2025-01-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Tiago Mestre', 'Sergiu Manic', 'Tiago Mestre', TIMESTAMPTZ '2025-01-01 00:00:00+00', 0, 1, 1, 0, 0, 1),
        ('João Espírito Santo', 'Karina Freitas', 'João Espírito Santo', TIMESTAMPTZ '2025-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Karina Freitas', 'Tiago Mestre', 'Karina Freitas', TIMESTAMPTZ '2025-02-01 00:00:00+00', 0, 1, 1, 0, 1, 0),
        ('Ângela Fernandes', 'Sergiu Manic', 'Ângela Fernandes', TIMESTAMPTZ '2025-02-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Hélio', 'Pedro Nogueira', 'Hélio', TIMESTAMPTZ '2025-02-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Hélio', 'Sergiu Manic', 'Hélio', TIMESTAMPTZ '2025-03-01 00:00:00+00', 0, 1, 1, 0, 1, 0),
        ('Ângela Fernandes', 'Karina Freitas', 'Ângela Fernandes', TIMESTAMPTZ '2025-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('João Espírito Santo', 'Tiago Mestre', 'João Espírito Santo', TIMESTAMPTZ '2025-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Hélio', 'Karina Freitas', 'Hélio', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Pedro Nogueira', 'Sergiu Manic', 'Pedro Nogueira', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Karina Freitas', 'Pedro Nogueira', 'Karina Freitas', TIMESTAMPTZ '2025-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('João Espírito Santo', 'Hélio', 'João Espírito Santo', TIMESTAMPTZ '2025-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Ângela Fernandes', 'Tiago Mestre', 'Ângela Fernandes', TIMESTAMPTZ '2025-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Hélio', 'Tiago Mestre', 'Hélio', TIMESTAMPTZ '2025-06-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('João Espírito Santo', 'Pedro Nogueira', 'João Espírito Santo', TIMESTAMPTZ '2025-06-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Karina Freitas', 'Sergiu Manic', 'Karina Freitas', TIMESTAMPTZ '2025-06-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('João Espírito Santo', 'Sergiu Manic', 'João Espírito Santo', TIMESTAMPTZ '2025-07-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Pedro Nogueira', 'Tiago Mestre', 'Pedro Nogueira', TIMESTAMPTZ '2025-07-01 00:00:00+00', 0, 1, 1, 0, 1, 0),
        ('Hélio', 'Ângela Fernandes', 'Hélio', TIMESTAMPTZ '2025-07-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),

        ('Peter Crorkan Ritchie', 'Frederico Vilarinho', 'Peter Crorkan Ritchie', TIMESTAMPTZ '2025-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Daniel Moreira', 'Carina Meireles', 'Daniel Moreira', TIMESTAMPTZ '2025-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Mauro Julião', 'Bruno Pereira', 'Mauro Julião', TIMESTAMPTZ '2025-01-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Bruno Pereira', 'Carina Meireles', 'Bruno Pereira', TIMESTAMPTZ '2025-02-01 00:00:00+00', 0, 1, 1, 0, 1, 0),
        ('Frederico Vilarinho', 'Daniel Moreira', 'Frederico Vilarinho', TIMESTAMPTZ '2025-02-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Mauro Julião', 'Carina Meireles', 'Mauro Julião', TIMESTAMPTZ '2025-03-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Frederico Vilarinho', 'Bruno Pereira', 'Frederico Vilarinho', TIMESTAMPTZ '2025-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Peter Crorkan Ritchie', 'Daniel Moreira', 'Peter Crorkan Ritchie', TIMESTAMPTZ '2025-03-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Bruno Pereira', 'Daniel Moreira', 'Bruno Pereira', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Frederico Vilarinho', 'Mauro Julião', 'Frederico Vilarinho', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 0, 1, 1, 0),
        ('Peter Crorkan Ritchie', 'Carina Meireles', 'Peter Crorkan Ritchie', TIMESTAMPTZ '2025-04-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Peter Crorkan Ritchie', 'Bruno Pereira', 'Peter Crorkan Ritchie', TIMESTAMPTZ '2025-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL),
        ('Frederico Vilarinho', 'Carina Meireles', 'Frederico Vilarinho', TIMESTAMPTZ '2025-05-01 00:00:00+00', 1, 0, 1, 0, NULL, NULL)
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
      2 AS season,
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
    AND em.phase = 'league'
    AND em.status = 'completed'
    AND em.winner_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM elo_matches elo
      WHERE elo.source_type = 'edition_match'
        AND elo.source_match_id = em.id
    );
END $$;
