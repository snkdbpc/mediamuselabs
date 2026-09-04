-- ============================================================
-- MediaMuse / MediaMuseLabs Migration:
-- Add `language` column to `user_presets` and `project_presets` tables
-- Run this query in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/komyevvnnzfhhiixqryr/sql/new
-- ============================================================

-- 1. Add language column to user_presets
ALTER TABLE user_presets 
ADD COLUMN IF NOT EXISTS language VARCHAR(100) NOT NULL DEFAULT 'English';

-- 2. Add language column to project_presets
ALTER TABLE project_presets 
ADD COLUMN IF NOT EXISTS language VARCHAR(100) NOT NULL DEFAULT 'English';

-- Optional documentation comments
COMMENT ON COLUMN user_presets.language IS 'Primary language for generating social media posts (e.g. English, Spanish, French, etc.)';
COMMENT ON COLUMN project_presets.language IS 'Primary language for generating social media posts (e.g. English, Spanish, French, etc.)';
