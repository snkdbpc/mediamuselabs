-- ============================================================
-- MediaMuse / MediaMuseLabs Migration:
-- Add `is_pro` status to `users` table
-- Run this query in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/komyevvnnzfhhiixqryr/sql/new
-- ============================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional comment explaining field purpose
COMMENT ON COLUMN users.is_pro IS 'Designates whether user has Pro Tier membership for unlimited data uploads';
