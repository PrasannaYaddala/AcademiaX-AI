CREATE TABLE IF NOT EXISTS timetable_entries (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    day_of_week VARCHAR(10) NOT NULL
        CHECK (day_of_week IN (
            'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
            'FRIDAY', 'SATURDAY', 'SUNDAY'
        )),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    classroom VARCHAR(120),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT timetable_entry_valid_time CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_timetable_course_day_time
    ON timetable_entries(course_id, day_of_week, start_time);
