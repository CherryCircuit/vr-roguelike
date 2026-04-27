-- Crash Reports Table for Spaceomicide
-- Auto-populated by /api/report-error endpoint from client-side error handlers
-- Run this in Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS crash_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  
  -- Error details
  error_type TEXT NOT NULL DEFAULT 'Error',
  error_message TEXT NOT NULL,
  stack_trace TEXT DEFAULT '',
  
  -- Game state at time of crash
  level INT,
  boss_name TEXT DEFAULT '',
  boss_phase INT,
  weapon TEXT DEFAULT '',
  health INT,
  score INT,
  kills INT,
  session_playthrough INT,
  
  -- Environment info
  url TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  renderer_info TEXT DEFAULT '',
  fps NUMERIC(5,1),
  memory_mb NUMERIC(8,1),
  
  -- Metadata
  timestamp TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying recent crashes
CREATE INDEX IF NOT EXISTS idx_crash_reports_timestamp ON crash_reports (timestamp DESC);

-- Index for finding crashes by error type
CREATE INDEX IF NOT EXISTS idx_crash_reports_error_type ON crash_reports (error_type);

-- Index for finding crashes by level
CREATE INDEX IF NOT EXISTS idx_crash_reports_level ON crash_reports (level);

-- Index for finding crashes by boss
CREATE INDEX IF NOT EXISTS idx_crash_reports_boss ON crash_reports (boss_name);

-- RLS: Allow anonymous inserts (client sends to API, not directly)
ALTER TABLE crash_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON crash_reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role full access" ON crash_reports
  FOR ALL USING (true) WITH CHECK (true);

-- Optional: Auto-purge reports older than 90 days
-- Uncomment if you want automatic cleanup:
-- CREATE OR REPLACE FUNCTION purge_old_crash_reports()
-- RETURNS void AS $$
-- BEGIN
--   DELETE FROM crash_reports WHERE created_at < now() - interval '90 days';
-- END;
-- $$ LANGUAGE plpgsql;
--
-- SELECT cron.schedule('purge-crash-reports', '0 3 * * *', 'SELECT purge_old_crash_reports()');
