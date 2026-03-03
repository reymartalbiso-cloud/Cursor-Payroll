-- Manual fix: Convert payment_basis from enum to text (for custom payment basis support)
-- Run this in Supabase SQL Editor or psql if "prisma db push" fails.
-- Replace 'outsource_payment_basis' with your actual enum name if different.

-- Step 1: Alter the column to text (PostgreSQL)
ALTER TABLE outsource_projects 
ALTER COLUMN payment_basis TYPE text 
USING payment_basis::text;

-- Step 2: Set default if needed
ALTER TABLE outsource_projects 
ALTER COLUMN payment_basis SET DEFAULT 'EFFECTIVE_HOUR';

-- Step 3: Drop the old enum type (optional, only if it exists and is unused)
-- DROP TYPE IF EXISTS outsource_payment_basis;
