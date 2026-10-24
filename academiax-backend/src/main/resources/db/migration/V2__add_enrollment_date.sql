ALTER TABLE enrollments
    ADD COLUMN IF NOT EXISTS enrollment_date TIMESTAMP;
