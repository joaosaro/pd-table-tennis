DROP POLICY IF EXISTS "Anyone can view recommendations" ON weekly_recommendations;
DROP POLICY IF EXISTS "Admins can insert recommendations" ON weekly_recommendations;
DROP POLICY IF EXISTS "Admins can delete recommendations" ON weekly_recommendations;

DROP TABLE IF EXISTS weekly_recommendations;
