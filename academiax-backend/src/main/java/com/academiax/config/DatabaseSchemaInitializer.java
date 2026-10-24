package com.academiax.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StreamUtils;

@Component
public class DatabaseSchemaInitializer implements ApplicationRunner {

    private final JdbcTemplate db;

    public DatabaseSchemaInitializer(JdbcTemplate db) {
        this.db = db;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        executeMigration("db/migration/V1__create_attendance.sql");
        executeMigration("db/migration/V2__add_enrollment_date.sql");
        executeMigration("db/migration/V3__create_timetable.sql");
    }

    private void executeMigration(String path) throws IOException {
        ClassPathResource migration = new ClassPathResource(path);
        String sql = StreamUtils.copyToString(
                migration.getInputStream(), StandardCharsets.UTF_8);
        db.execute(sql);
    }
}
