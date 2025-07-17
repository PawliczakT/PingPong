ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS bracket TEXT CHECK (bracket IN ('winner', 'loser')),
ADD COLUMN IF NOT EXISTS stage TEXT,
ADD COLUMN IF NOT EXISTS is_if_game BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket ON tournament_matches(tournament_id, bracket);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_stage ON tournament_matches(tournament_id, stage);
