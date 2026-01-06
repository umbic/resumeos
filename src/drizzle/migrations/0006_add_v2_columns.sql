-- V2 Pipeline columns for multi-agent architecture
-- Add columns to sessions table for V2 pipeline state

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS v2_session JSONB,
ADD COLUMN IF NOT EXISTS v2_diagnostics JSONB,
ADD COLUMN IF NOT EXISTS v2_status TEXT;

-- Index for quick queries on pipeline state
CREATE INDEX IF NOT EXISTS idx_sessions_v2_status
ON sessions(v2_status);
