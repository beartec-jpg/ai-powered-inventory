-- Migration: Add user scoping to catalogue_items and stock_levels tables
-- This migration adds userId columns to enable per-user data isolation

-- Step 1: Add user_id column to catalogue_items (with temporary default)
ALTER TABLE catalogue_items ADD COLUMN user_id TEXT;

-- Step 2: Set a temporary default for existing rows (should be empty in practice)
UPDATE catalogue_items SET user_id = 'migration_default' WHERE user_id IS NULL;

-- Step 3: Make user_id NOT NULL
ALTER TABLE catalogue_items ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Drop old unique constraint on part_number (part numbers should be unique per user, not globally)
DROP INDEX IF EXISTS catalogue_items_part_number_idx;

-- Step 5: Create new composite unique index on (user_id, part_number)
CREATE UNIQUE INDEX catalogue_items_user_part_number_idx ON catalogue_items(user_id, part_number);

-- Step 6: Create index on user_id for query performance
CREATE INDEX catalogue_items_user_id_idx ON catalogue_items(user_id);

-- Step 7: Add user_id column to stock_levels (with temporary default)
ALTER TABLE stock_levels ADD COLUMN user_id TEXT;

-- Step 8: Set a temporary default for existing rows (should be empty in practice)
UPDATE stock_levels SET user_id = 'migration_default' WHERE user_id IS NULL;

-- Step 9: Make user_id NOT NULL
ALTER TABLE stock_levels ALTER COLUMN user_id SET NOT NULL;

-- Step 10: Drop old unique constraint on (catalogue_item_id, location)
DROP INDEX IF EXISTS stock_levels_catalogue_item_location_idx;

-- Step 11: Create new composite unique index on (user_id, catalogue_item_id, location)
CREATE UNIQUE INDEX stock_levels_user_catalogue_item_location_idx ON stock_levels(user_id, catalogue_item_id, location);

-- Step 12: Create index on user_id for query performance
CREATE INDEX stock_levels_user_id_idx ON stock_levels(user_id);

-- Migration complete
-- Data is now scoped per user
