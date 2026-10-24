package com.academiax;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.web.client.RestClientException;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.academiax.config.ApiSessionInterceptor;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:5180"
}, allowCredentials = "true")
public class AcademiaxApiController {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Logger LOGGER =
            LoggerFactory.getLogger(AcademiaxApiController.class);

    private final JdbcTemplate db;
    private final PasswordEncoder encoder;
    private final RazorpayPaymentService razorpay;
    private final ObjectMapper objectMapper;

    public AcademiaxApiController(
            JdbcTemplate db,
            PasswordEncoder encoder,
            RazorpayPaymentService razorpay,
            ObjectMapper objectMapper) {
        this.db = db;
        this.encoder = encoder;
        this.razorpay = razorpay;
        this.objectMapper = objectMapper;
    }

    private Map<String, Object> message(String text) {
        return Map.of("message", text);
    }

    private ResponseEntity<Map<String, Object>> error(
            String text, HttpStatus status) {
        return ResponseEntity.status(status).body(message(text));
    }

    private String value(Map<String, Object> body, String key) {
        Object v = body.get(key);
        return v == null ? "" : v.toString().trim();
    }

    private Long number(Map<String, Object> body, String key) {
        try {
            return Long.parseLong(value(body, key));
        } catch (Exception e) {
            return null;
        }
    }

    private Long numberValue(Object value) {
        try {
            return value == null ? null : Long.valueOf(value.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // 1. DATABASE CONNECTION TEST
    @GetMapping("/health/database")
    public Map<String, Object> databaseHealth() {
        Map<String, Object> result = new HashMap<>();

        result.put("status", "connected");
        result.put("database", db.queryForObject(
                "SELECT current_database()", String.class));

        result.put("tables", db.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables " +
                "WHERE table_schema='public' AND table_type='BASE TABLE'",
                Integer.class));

        return result;
    }

    // 2. REGISTER STUDENT OR TEACHER
    @PostMapping("/auth/register")
    public ResponseEntity<?> register(
            @RequestBody Map<String, Object> body) {

        String name = value(body, "name");
        String email = value(body, "email").toLowerCase();
        String password = body.get("password") == null
                ? "" : body.get("password").toString();
        String role = value(body, "role").toUpperCase();

        if (name.isBlank() || email.isBlank() || password.isBlank()) {
            return error(
                    "Name, email and password are required.",
                    HttpStatus.BAD_REQUEST);
        }

        if (!password.matches(
                "^(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s])\\S{8,}$")) {
            return error(
                    "Password must contain at least 8 characters, " +
                    "one uppercase letter, one number and one special symbol, " +
                    "with no spaces.",
                    HttpStatus.BAD_REQUEST);
        }

        if (!email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return error(
                    "Enter a valid email address.",
                    HttpStatus.BAD_REQUEST);
        }

        if (!role.equals("STUDENT") && !role.equals("TEACHER")) {
            return error(
                    "Role must be STUDENT or TEACHER.",
                    HttpStatus.BAD_REQUEST);
        }

        Integer count = db.queryForObject(
                "SELECT COUNT(*) FROM users WHERE LOWER(email)=?",
                Integer.class, email);

        if (count != null && count > 0) {
            return error(
                    "Email is already registered.",
                    HttpStatus.CONFLICT);
        }

        Integer year = null;
        Integer semester = null;

        try {
            if (!value(body, "yearOfStudy").isBlank()) {
                year = Integer.valueOf(value(body, "yearOfStudy"));
            }

            if (!value(body, "semester").isBlank()) {
                semester = Integer.valueOf(value(body, "semester"));
            }
        } catch (NumberFormatException e) {
            return error(
                    "Year and semester must be numbers.",
                    HttpStatus.BAD_REQUEST);
        }

        if (year != null && (year < 1 || year > 6)) {
            return error(
                    "Year of study must be between 1 and 6.",
                    HttpStatus.BAD_REQUEST);
        }

        if (semester != null && (semester < 1 || semester > 12)) {
            return error(
                    "Semester must be between 1 and 12.",
                    HttpStatus.BAD_REQUEST);
        }

        try {
            Long id = db.queryForObject(
                    "INSERT INTO users " +
                    "(name,email,password_hash,role,branch,year_of_study,semester) " +
                    "VALUES (?,?,?,?,?,?,?) RETURNING id",
                    Long.class,
                    name,
                    email,
                    encoder.encode(password),
                    role,
                    value(body, "branch").isBlank()
                            ? null : value(body, "branch"),
                    year,
                    semester);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Registration successful.");
            response.put("id", id);
            response.put("name", name);
            response.put("email", email);
            response.put("role", role);

            return ResponseEntity.status(HttpStatus.CREATED).body(response);

        } catch (DuplicateKeyException e) {
            return error(
                    "Email is already registered.",
                    HttpStatus.CONFLICT);
        }
    }

    // 3. LOGIN
    @PostMapping("/auth/login")
    public ResponseEntity<?> login(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {

        String email = value(body, "email").toLowerCase();
        String password = body.get("password") == null
                ? "" : body.get("password").toString();

        if (email.isBlank() || password.isEmpty()) {
            return error(
                    "Email and password are required.",
                    HttpStatus.BAD_REQUEST);
        }

        List<Map<String, Object>> users = db.queryForList(
                "SELECT id,name,email,password_hash,role,branch," +
                "year_of_study,semester FROM users WHERE LOWER(email)=?",
                email);

        if (users.isEmpty()) {
            return error(
                    "Invalid email or password.",
                    HttpStatus.UNAUTHORIZED);
        }

        Map<String, Object> user = users.get(0);
        Object hashValue = user.get("password_hash");

        if (hashValue == null ||
                !encoder.matches(password, hashValue.toString())) {
            return error(
                    "Invalid email or password.",
                    HttpStatus.UNAUTHORIZED);
        }

        user.remove("password_hash");
        HttpSession previousSession = request.getSession(false);
        if (previousSession != null) {
            previousSession.invalidate();
        }

        HttpSession session = request.getSession(true);
        session.setMaxInactiveInterval(8 * 60 * 60);
        session.setAttribute(ApiSessionInterceptor.USER_ID, user.get("id"));
        session.setAttribute(
                ApiSessionInterceptor.USER_ROLE,
                user.get("role").toString().toUpperCase());

        byte[] csrfBytes = new byte[32];
        SECURE_RANDOM.nextBytes(csrfBytes);
        String csrfToken = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(csrfBytes);
        session.setAttribute(ApiSessionInterceptor.CSRF_TOKEN, csrfToken);

        user.put("csrfToken", csrfToken);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/auth/session")
    public ResponseEntity<?> currentSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null
                || session.getAttribute(ApiSessionInterceptor.USER_ID) == null) {
            return error("No active session.", HttpStatus.UNAUTHORIZED);
        }

        Long userId = Long.valueOf(
                session.getAttribute(ApiSessionInterceptor.USER_ID).toString());
        List<Map<String, Object>> users = db.queryForList(
                "SELECT id,name,email,role,branch,year_of_study,semester "
                        + "FROM users WHERE id=?",
                userId);
        if (users.isEmpty()) {
            session.invalidate();
            return error("The signed-in account no longer exists.", HttpStatus.UNAUTHORIZED);
        }

        Map<String, Object> user = users.get(0);
        user.put(
                "csrfToken",
                session.getAttribute(ApiSessionInterceptor.CSRF_TOKEN));
        return ResponseEntity.ok(user);
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.ok(message("Signed out successfully."));
    }

    // 4. LIST COURSES
    @GetMapping("/courses")
    public List<Map<String, Object>> courses(HttpServletRequest request) {
        Object userId = request.getAttribute(ApiSessionInterceptor.USER_ID);
        Object role = request.getAttribute(ApiSessionInterceptor.USER_ROLE);
        if (userId != null && role != null
                && ("TEACHER".equals(role) || "INSTRUCTOR".equals(role))) {
            return db.queryForList(
                    "SELECT c.id,c.code,c.name,c.description,c.teacher_id,"
                            + "u.name AS instructor,c.capacity,"
                            + "(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS enrolled,"
                            + "c.capacity-(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS available_seats,"
                            + "c.enrollment_deadline "
                            + "FROM courses c LEFT JOIN users u ON u.id=c.teacher_id "
                            + "WHERE c.teacher_id=? ORDER BY c.id",
                    Long.valueOf(userId.toString()));
        }

        return db.queryForList(
                "SELECT c.id,c.code,c.name,c.description,c.teacher_id," +
                "u.name AS instructor,c.capacity," +
                "(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS enrolled," +
                "c.capacity-(SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) AS available_seats," +
                "c.enrollment_deadline " +
                "FROM courses c LEFT JOIN users u ON u.id=c.teacher_id " +
                "ORDER BY c.id");
    }

    // 5. CREATE COURSE
    @PostMapping("/courses")
    public ResponseEntity<?> createCourse(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {

        String code = value(body, "code");
        String name = value(body, "name");
        Long capacity = number(body, "capacity");
        String teacherText = value(body, "teacherId");
        String deadline = value(body, "enrollmentDeadline");
        Long authenticatedTeacherId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());

        if (!authenticatedTeacherId.equals(number(body, "teacherId"))) {
            return error(
                    "Courses can only be assigned to the signed-in teacher.",
                    HttpStatus.FORBIDDEN);
        }

        if (code.isBlank() || name.isBlank() ||
                capacity == null || capacity < 1 ||
                capacity > Integer.MAX_VALUE) {
            return error(
                    "Enter a course code, name and valid capacity.",
                    HttpStatus.BAD_REQUEST);
        }

        try {
            Long teacherId = teacherText.isBlank()
                    ? null : Long.valueOf(teacherText);

            Long id = db.queryForObject(
                    "INSERT INTO courses " +
                    "(code,name,description,teacher_id,capacity,enrollment_deadline) " +
                    "VALUES (?,?,?,?,?,?::timestamp) RETURNING id",
                    Long.class,
                    code,
                    name,
                    value(body, "description").isBlank()
                            ? null : value(body, "description"),
                    teacherId,
                    capacity.intValue(),
                    deadline.isBlank() ? null : deadline);

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of(
                            "id", id,
                            "message", "Course created successfully."));

        } catch (DuplicateKeyException e) {
            return error(
                    "Course code already exists.",
                    HttpStatus.CONFLICT);
        } catch (Exception e) {
            return error(
                    "Could not create course. Check teacher ID and date format.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    // 6. ENROLL STUDENT
    @PostMapping("/enrollments")
    @Transactional
    public ResponseEntity<?> enroll(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {

        Long studentId = number(body, "studentId");
        Long courseId = number(body, "courseId");
        Long authenticatedStudentId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());

        if (!authenticatedStudentId.equals(studentId)) {
            return error(
                    "Students can only enroll themselves.",
                    HttpStatus.FORBIDDEN);
        }

        if (studentId == null || courseId == null) {
            return error(
                    "studentId and courseId are required.",
                    HttpStatus.BAD_REQUEST);
        }

        try {
            Map<String, Object> student = db.queryForMap(
                    "SELECT role FROM users WHERE id=?", studentId);

            if (!"STUDENT".equals(student.get("role"))) {
                return error(
                        "Only students can enroll.",
                        HttpStatus.BAD_REQUEST);
            }

            Map<String, Object> course = db.queryForMap(
                    "SELECT capacity,enrollment_deadline FROM courses "
                            + "WHERE id=? FOR UPDATE",
                    courseId);

            Integer duplicate = db.queryForObject(
                    "SELECT COUNT(*) FROM enrollments " +
                    "WHERE student_id=? AND course_id=?",
                    Integer.class, studentId, courseId);

            if (duplicate != null && duplicate > 0) {
                return error(
                        "You are already enrolled in this course.",
                        HttpStatus.CONFLICT);
            }

            Object deadline = course.get("enrollment_deadline");

            if (deadline != null) {
                Integer expired = db.queryForObject(
                        "SELECT CASE WHEN ?::timestamp < CURRENT_TIMESTAMP " +
                        "THEN 1 ELSE 0 END",
                        Integer.class, deadline);

                if (expired != null && expired == 1) {
                    return error(
                            "Enrollment deadline has passed.",
                            HttpStatus.CONFLICT);
                }
            }

            Integer enrolled = db.queryForObject(
                    "SELECT COUNT(*) FROM enrollments WHERE course_id=?",
                    Integer.class, courseId);

            int capacity = ((Number) course.get("capacity")).intValue();

            if (enrolled != null && enrolled >= capacity) {
                return error(
                        "This course is full.",
                        HttpStatus.CONFLICT);
            }

            int inserted = db.update(
                    "INSERT INTO enrollments(student_id,course_id,enrollment_date) "
                            + "VALUES (?, ?, CURRENT_TIMESTAMP) "
                            + "ON CONFLICT (student_id,course_id) "
                            + "DO NOTHING",
                    studentId, courseId);

            if (inserted == 0) {
                return error(
                        "You are already enrolled in this course.",
                        HttpStatus.CONFLICT);
            }

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(message("Enrollment successful."));

        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            return error(
                    "Student or course was not found.",
                    HttpStatus.NOT_FOUND);
        } catch (DuplicateKeyException e) {
            return error(
                    "You are already enrolled in this course.",
                    HttpStatus.CONFLICT);
        }
    }

    // 7. GET A STUDENT'S EXISTING ENROLLMENTS
    @GetMapping("/enrollments/student/{studentId}")
    public ResponseEntity<?> getStudentEnrollments(
            @PathVariable Long studentId) {

        Integer studentExists = db.queryForObject(
                "SELECT COUNT(*) FROM users WHERE id=? AND role='STUDENT'",
                Integer.class, studentId);

        if (studentExists == null || studentExists == 0) {
            return error(
                    "Student was not found.",
                    HttpStatus.NOT_FOUND);
        }

        List<Map<String, Object>> enrollments = db.queryForList(
                "SELECT e.course_id,c.name AS course_name,c.code AS course_code,"
                        + "u.name AS instructor,"
                        + "COALESCE(to_jsonb(e)->>'enrollment_date',"
                        + "to_jsonb(e)->>'enrolled_at',"
                        + "to_jsonb(e)->>'created_at',"
                        + "to_jsonb(e)->>'created_on',"
                        + "to_jsonb(e)->>'enrollment_timestamp') AS enrollment_date,"
                        + "COALESCE(to_jsonb(e)->>'status','ENROLLED') AS status "
                        + "FROM enrollments e "
                        + "JOIN courses c ON c.id=e.course_id "
                        + "LEFT JOIN users u ON u.id=c.teacher_id "
                        + "WHERE e.student_id=? ORDER BY e.course_id",
                studentId);

        return ResponseEntity.ok(enrollments);
    }

    // 8. LIST ASSIGNMENTS
    @GetMapping("/assignments")
    public List<Map<String, Object>> assignments(HttpServletRequest request) {
        Long userId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());
        String role = request.getAttribute(
                ApiSessionInterceptor.USER_ROLE).toString();

        if ("TEACHER".equals(role) || "INSTRUCTOR".equals(role)) {
            return db.queryForList(
                    "SELECT a.id,a.course_id,c.name AS course_name,"
                            + "a.title,a.description,a.due_date,a.created_at "
                            + "FROM assignments a JOIN courses c ON c.id=a.course_id "
                            + "WHERE c.teacher_id=? ORDER BY a.due_date",
                    userId);
        }
        if ("STUDENT".equals(role)) {
            return db.queryForList(
                    "SELECT a.id,a.course_id,c.name AS course_name,"
                            + "a.title,a.description,a.due_date,a.created_at "
                            + "FROM assignments a JOIN courses c ON c.id=a.course_id "
                            + "JOIN enrollments e ON e.course_id=c.id "
                            + "WHERE e.student_id=? ORDER BY a.due_date",
                    userId);
        }

        return db.queryForList(
                "SELECT a.id,a.course_id,c.name AS course_name," +
                "a.title,a.description,a.due_date,a.created_at " +
                "FROM assignments a JOIN courses c ON c.id=a.course_id " +
                "ORDER BY a.due_date");
    }

    // 9. CREATE ASSIGNMENT
    @PostMapping("/assignments")
    public ResponseEntity<?> createAssignment(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {

        Long courseId = number(body, "courseId");
        String title = value(body, "title");
        String dueDate = value(body, "dueDate");

        if (courseId == null || title.isBlank() || dueDate.isBlank()) {
            return error(
                    "courseId, title and dueDate are required.",
                    HttpStatus.BAD_REQUEST);
        }

        Long teacherId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());
        Integer ownsCourse = db.queryForObject(
                "SELECT COUNT(*) FROM courses WHERE id=? AND teacher_id=?",
                Integer.class, courseId, teacherId);
        if (ownsCourse == null || ownsCourse == 0) {
            return error(
                    "You can only create assignments for courses assigned to you.",
                    HttpStatus.FORBIDDEN);
        }

        try {
            Long id = db.queryForObject(
                    "INSERT INTO assignments(course_id,title,description,due_date) " +
                    "VALUES (?,?,?,?::timestamp) RETURNING id",
                    Long.class,
                    courseId,
                    title,
                    value(body, "description").isBlank()
                            ? null : value(body, "description"),
                    dueDate);

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of(
                            "id", id,
                            "message", "Assignment created."));

        } catch (Exception e) {
            return error(
                    "Could not create assignment. Check course ID and date format.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    // 10. SUBMIT ASSIGNMENT
    @PostMapping("/submissions")
    public ResponseEntity<?> submitAssignment(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {

        Long assignmentId = number(body, "assignmentId");
        Long studentId = number(body, "studentId");
        Long authenticatedStudentId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());

        if (assignmentId == null || studentId == null) {
            return error(
                    "assignmentId and studentId are required.",
                    HttpStatus.BAD_REQUEST);
        }

        if (!authenticatedStudentId.equals(studentId)) {
            return error(
                    "Students can only submit their own work.",
                    HttpStatus.FORBIDDEN);
        }

        String text = value(body, "submissionText");
        String fileName = value(body, "fileName");
        String filePath = value(body, "filePath");

        if (text.isBlank() && filePath.isBlank()) {
            return error(
                    "Provide submission text or a file path.",
                    HttpStatus.BAD_REQUEST);
        }

        try {
            Integer student = db.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE id=? AND role='STUDENT'",
                    Integer.class, studentId);

            if (student == null || student == 0) {
                return error(
                        "Student not found.",
                        HttpStatus.NOT_FOUND);
            }

            Integer enrolled = db.queryForObject(
                    "SELECT COUNT(*) FROM assignments a " +
                    "JOIN enrollments e ON e.course_id=a.course_id " +
                    "WHERE a.id=? AND e.student_id=?",
                    Integer.class, assignmentId, studentId);

            if (enrolled == null || enrolled == 0) {
                return error(
                        "Student is not enrolled in this assignment's course.",
                        HttpStatus.FORBIDDEN);
            }

            db.update(
                    "INSERT INTO submissions " +
                    "(assignment_id,student_id,submission_text,file_name,file_path) " +
                    "VALUES (?,?,?,?,?) " +
                    "ON CONFLICT (assignment_id,student_id) DO UPDATE SET " +
                    "submission_text=EXCLUDED.submission_text," +
                    "file_name=EXCLUDED.file_name," +
                    "file_path=EXCLUDED.file_path," +
                    "submitted_at=CURRENT_TIMESTAMP,grade=NULL,feedback=NULL,graded_at=NULL",
                    assignmentId,
                    studentId,
                    text.isBlank() ? null : text,
                    fileName.isBlank() ? null : fileName,
                    filePath.isBlank() ? null : filePath);

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(message("Assignment submitted successfully."));

        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            return error(
                    "Assignment or student not found.",
                    HttpStatus.NOT_FOUND);
        }
    }

    // 11. TEACHER VIEWS COURSE SUBMISSIONS
    @GetMapping("/courses/{courseId}/submissions")
    public List<Map<String, Object>> courseSubmissions(
            @PathVariable Long courseId) {

        return db.queryForList(
                "SELECT s.id,s.assignment_id,a.title AS assignment_title," +
                "s.student_id,u.name AS student_name,u.email," +
                "s.submission_text,s.file_name,s.file_path,s.submitted_at," +
                "s.grade,s.feedback,s.graded_at " +
                "FROM submissions s " +
                "JOIN assignments a ON a.id=s.assignment_id " +
                "JOIN users u ON u.id=s.student_id " +
                "WHERE a.course_id=? ORDER BY s.submitted_at DESC",
                courseId);
    }

    // 12. TEACHER GRADES SUBMISSION
    @PutMapping("/submissions/{submissionId}/grade")
    public ResponseEntity<?> gradeSubmission(
            @PathVariable Long submissionId,
            @RequestBody Map<String, Object> body) {

        BigDecimal grade;

        try {
            grade = new BigDecimal(value(body, "grade"));
        } catch (Exception e) {
            return error(
                    "Enter a valid grade between 0 and 100.",
                    HttpStatus.BAD_REQUEST);
        }

        if (grade.compareTo(BigDecimal.ZERO) < 0 ||
                grade.compareTo(new BigDecimal("100")) > 0) {
            return error(
                    "Grade must be between 0 and 100.",
                    HttpStatus.BAD_REQUEST);
        }

        int updated = db.update(
                "UPDATE submissions SET grade=?,feedback=?," +
                "graded_at=CURRENT_TIMESTAMP WHERE id=?",
                grade,
                value(body, "feedback").isBlank()
                        ? null : value(body, "feedback"),
                submissionId);

        if (updated == 0) {
            return error(
                    "Submission not found.",
                    HttpStatus.NOT_FOUND);
        }

        return ResponseEntity.ok(
                message("Grade and feedback saved successfully."));
    }

    // 13. STUDENT VIEWS SUBMISSIONS AND GRADES

@GetMapping("/students/{studentId}/submissions")
public List<Map<String, Object>> studentSubmissions(
        @PathVariable Long studentId) {

    return db.queryForList(
            "SELECT s.id,s.assignment_id,a.title AS assignment_title," +
            "c.name AS course_name,s.submission_text,s.file_name," +
            "s.submitted_at,s.grade,s.feedback,s.graded_at," +
            "'SUBMITTED' AS status " +
            "FROM submissions s " +
            "JOIN assignments a ON a.id=s.assignment_id " +
            "JOIN courses c ON c.id=a.course_id " +
            "WHERE s.student_id=? ORDER BY s.submitted_at DESC",
            studentId);
}

// Demo entries are never treated as proof of a real payment.
@PostMapping("/payments/demo")
public ResponseEntity<?> createDemoPayment(
        @RequestBody Map<String, Object> body,
        HttpServletRequest request) {
    Long studentId = Long.valueOf(
            request.getAttribute(ApiSessionInterceptor.USER_ID).toString());
    BigDecimal amount;
    try {
        amount = new BigDecimal(value(body, "amount"))
                .setScale(2, RoundingMode.UNNECESSARY);
    } catch (NumberFormatException | ArithmeticException exception) {
        return error("Enter a valid demo amount.", HttpStatus.BAD_REQUEST);
    }

    String description = value(body, "description");
    if (amount.compareTo(BigDecimal.ZERO) <= 0
            || amount.compareTo(new BigDecimal("9999999999.99")) > 0
            || description.isBlank()
            || description.length() > 249) {
        return error(
                "Enter a valid amount and a description of up to 249 characters.",
                HttpStatus.BAD_REQUEST);
    }

    try {
        Long id = db.queryForObject(
                "INSERT INTO payments(student_id,amount,description,status) " +
                "VALUES (?,?,?,'PENDING') RETURNING id",
                Long.class, studentId, amount, "DEMO: " + description);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of(
                        "id", id,
                        "status", "DEMO",
                        "message", "Demo payment record created. No money was charged."));
    } catch (DataAccessException exception) {
        LOGGER.error("Could not create demo payment record for student {}.",
                studentId, exception);
        return error(
                "Could not save the demo payment record.",
                HttpStatus.INTERNAL_SERVER_ERROR);
    }
}

// 14. CREATE A PROVIDER ORDER FOR A STUDENT PAYMENT
@PostMapping("/payments/checkout")
    public ResponseEntity<?> createPaymentOrder(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        Long authenticatedStudentId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());
        if (!razorpay.isConfigured()) {
            return error(
                    "Razorpay is not configured on this server. The backend administrator must set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from the Razorpay Dashboard, then restart Spring Boot.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }

        BigDecimal amount;
        try {
            amount = new BigDecimal(value(body, "amount"))
                    .setScale(2, RoundingMode.UNNECESSARY);
        } catch (NumberFormatException | ArithmeticException exception) {
            return error(
                    "Enter a valid payment amount.",
                    HttpStatus.BAD_REQUEST);
        }

        String description = value(body, "description");
        if (amount.compareTo(BigDecimal.ZERO) <= 0
                || amount.compareTo(new BigDecimal("9999999999.99")) > 0
                || description.isBlank()
                || description.length() > 255) {
            return error(
                    "Enter a valid amount and a description of up to 255 characters.",
                    HttpStatus.BAD_REQUEST);
        }

        long amountPaise;
        try {
            amountPaise = amount.movePointRight(2).longValueExact();
        } catch (ArithmeticException exception) {
            return error("Enter a valid payment amount.", HttpStatus.BAD_REQUEST);
        }

        String receipt = "ax-" + UUID.randomUUID().toString().replace("-", "");
        Map<String, Object> order;
        try {
            order = razorpay.createOrder(amountPaise, receipt);
        } catch (RestClientException exception) {
            LOGGER.warn("Razorpay order creation failed.", exception);
            return error(
                    "Could not start checkout with Razorpay. Please try again.",
                    HttpStatus.BAD_GATEWAY);
        }

        if (order == null
                || !(order.get("id") instanceof String orderId)
                || !(order.get("amount") instanceof Number orderAmount)
                || orderAmount.longValue() != amountPaise
                || !"INR".equals(order.get("currency"))) {
            LOGGER.error("Razorpay returned an invalid order response.");
            return error(
                    "Could not start checkout with Razorpay. Please try again.",
                    HttpStatus.BAD_GATEWAY);
        }

        try {
            Long paymentRecordId = db.queryForObject(
                    "INSERT INTO payments" +
                    "(student_id,amount,description,status,razorpay_order_id) " +
                    "VALUES (?,?,?,'PENDING',?) RETURNING id",
                    Long.class, authenticatedStudentId, amount, description, orderId);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of(
                            "paymentRecordId", paymentRecordId,
                            "orderId", orderId,
                            "amount", amountPaise,
                            "currency", "INR",
                            "keyId", razorpay.getKeyId()));
        } catch (DataAccessException exception) {
            LOGGER.error("Could not save Razorpay order {}.", orderId, exception);
            return error(
                    "Could not save the payment record. Please try again.",
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // 15. VERIFY A CHECKOUT PAYMENT BEFORE MARKING IT PAID
    @PostMapping("/payments/verify")
    public ResponseEntity<?> verifyPayment(
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        Long studentId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());
        String orderId = value(body, "orderId");
        String paymentId = value(body, "paymentId");
        String signature = value(body, "signature");

        if (orderId.isBlank() || paymentId.isBlank() || signature.isBlank()) {
            return error(
                    "Payment verification details are incomplete.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!razorpay.isConfigured()) {
            return error(
                    "Online payments are not configured.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (!razorpay.isValidPaymentSignature(orderId, paymentId, signature)) {
            return error(
                    "The payment signature could not be verified.",
                    HttpStatus.BAD_REQUEST);
        }

        List<Map<String, Object>> matchingPayments = db.queryForList(
                "SELECT id,amount,status,razorpay_payment_id " +
                "FROM payments WHERE razorpay_order_id=? AND student_id=?",
                orderId, studentId);
        if (matchingPayments.isEmpty()) {
            return error("Payment order not found.", HttpStatus.NOT_FOUND);
        }

        Map<String, Object> record = matchingPayments.get(0);
        if ("PAID".equals(record.get("status"))) {
            if (paymentId.equals(record.get("razorpay_payment_id"))) {
                return ResponseEntity.ok(message("Payment already verified."));
            }
            return error(
                    "This order has already been paid.",
                    HttpStatus.CONFLICT);
        }

        Map<String, Object> providerPayment;
        try {
            providerPayment = razorpay.fetchPayment(paymentId);
        } catch (RestClientException exception) {
            LOGGER.warn("Could not retrieve Razorpay payment {}.", paymentId, exception);
            return error(
                    "Could not verify payment with Razorpay. Refresh and try again.",
                    HttpStatus.BAD_GATEWAY);
        }

        long expectedAmountPaise = ((BigDecimal) record.get("amount"))
                .movePointRight(2)
                .longValueExact();
        if (providerPayment == null
                || !orderId.equals(providerPayment.get("order_id"))
                || !"INR".equals(providerPayment.get("currency"))
                || numberValue(providerPayment.get("amount")) == null
                || numberValue(providerPayment.get("amount")) != expectedAmountPaise
                || !"captured".equals(providerPayment.get("status"))) {
            return error(
                    "Razorpay has not confirmed a captured payment for this order yet.",
                    HttpStatus.CONFLICT);
        }

        int updated = db.update(
                "UPDATE payments SET status='PAID',paid_at=CURRENT_TIMESTAMP," +
                "razorpay_payment_id=? WHERE razorpay_order_id=? " +
                "AND student_id=? AND status='PENDING' " +
                "AND razorpay_payment_id IS NULL",
                paymentId, orderId, studentId);
        if (updated == 0) {
            List<Map<String, Object>> latest = db.queryForList(
                    "SELECT status,razorpay_payment_id FROM payments " +
                    "WHERE razorpay_order_id=? AND student_id=?",
                    orderId, studentId);
            if (!latest.isEmpty()
                    && "PAID".equals(latest.get(0).get("status"))
                    && paymentId.equals(latest.get(0).get("razorpay_payment_id"))) {
                return ResponseEntity.ok(message("Payment verified successfully."));
            }
            return error(
                    "The payment record changed before verification completed.",
                    HttpStatus.CONFLICT);
        }
        return ResponseEntity.ok(message("Payment verified successfully."));
    }

    // 16. ACCEPT CAPTURE CONFIRMATION FROM RAZORPAY WEBHOOKS
    @PostMapping("/payments/webhook")
    public ResponseEntity<?> razorpayWebhook(
            @RequestBody String payload,
            @RequestHeader(
                    value = "X-Razorpay-Signature",
                    required = false) String signature) {
        if (!razorpay.isWebhookConfigured()) {
            return error(
                    "Razorpay webhook verification is not configured.",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (!razorpay.isValidWebhookSignature(payload, signature)) {
            return error("Invalid Razorpay webhook signature.", HttpStatus.BAD_REQUEST);
        }

        try {
            JsonNode event = objectMapper.readTree(payload);
            if (!"payment.captured".equals(event.path("event").asText())) {
                return ResponseEntity.ok(message("Webhook event acknowledged."));
            }

            JsonNode payment = event.path("payload").path("payment").path("entity");
            String orderId = payment.path("order_id").asText();
            String paymentId = payment.path("id").asText();
            Long amountPaise = numberValue(payment.get("amount"));
            if (orderId.isBlank() || paymentId.isBlank() || amountPaise == null
                    || !"INR".equals(payment.path("currency").asText())
                    || !"captured".equals(payment.path("status").asText())) {
                return error("Invalid captured payment event.", HttpStatus.BAD_REQUEST);
            }

            int updated = db.update(
                    "UPDATE payments SET status='PAID',paid_at=CURRENT_TIMESTAMP," +
                    "razorpay_payment_id=? WHERE razorpay_order_id=? " +
                    "AND amount=? AND status='PENDING' " +
                    "AND razorpay_payment_id IS NULL",
                    paymentId,
                    orderId,
                    BigDecimal.valueOf(amountPaise, 2));
            if (updated == 0) {
                List<Map<String, Object>> existing = db.queryForList(
                        "SELECT status,razorpay_payment_id FROM payments " +
                        "WHERE razorpay_order_id=?",
                        orderId);
                if (!existing.isEmpty()
                        && "PAID".equals(existing.get(0).get("status"))
                        && paymentId.equals(existing.get(0).get("razorpay_payment_id"))) {
                    return ResponseEntity.ok(message("Webhook event acknowledged."));
                }
                return error(
                        "No matching pending payment was found.",
                        HttpStatus.NOT_FOUND);
            }
            return ResponseEntity.ok(message("Payment capture recorded."));
        } catch (JacksonException exception) {
            return error("Invalid Razorpay webhook payload.", HttpStatus.BAD_REQUEST);
        }
    }

    // 17. STUDENT VIEWS PAYMENTS
    @GetMapping("/students/{studentId}/payments")
    public List<Map<String, Object>> studentPayments(
            @PathVariable Long studentId) {

        return db.queryForList(
                "SELECT id,student_id,amount,description,status,paid_at,created_at " +
                "FROM payments WHERE student_id=? ORDER BY created_at DESC",
                studentId);
    }

    @GetMapping("/students/{studentId}/attendance")
    public List<Map<String, Object>> studentAttendance(
            @PathVariable Long studentId) {
        return db.queryForList(
                "SELECT a.id,a.course_id,c.name AS course_name,"
                        + "a.attendance_date,a.status,a.created_at "
                        + "FROM attendance a JOIN courses c ON c.id=a.course_id "
                        + "WHERE a.student_id=? ORDER BY a.attendance_date DESC,c.name",
                studentId);
    }

    @GetMapping("/courses/{courseId}/attendance")
    public List<Map<String, Object>> courseAttendance(
            @PathVariable Long courseId) {
        return db.queryForList(
                "SELECT a.id,a.course_id,a.student_id,u.name AS student_name,"
                        + "a.attendance_date,a.status,a.created_at "
                        + "FROM attendance a JOIN users u ON u.id=a.student_id "
                        + "WHERE a.course_id=? ORDER BY a.attendance_date DESC,u.name",
                courseId);
    }

    @GetMapping("/courses/{courseId}/students")
    public List<Map<String, Object>> courseStudents(
            @PathVariable Long courseId) {
        return db.queryForList(
                "SELECT u.id,u.name,u.email "
                        + "FROM enrollments e JOIN users u ON u.id=e.student_id "
                        + "WHERE e.course_id=? AND u.role='STUDENT' "
                        + "ORDER BY u.name",
                courseId);
    }

    @GetMapping("/timetable")
    public List<Map<String, Object>> timetable(HttpServletRequest request) {
        Long userId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());
        String role = request.getAttribute(ApiSessionInterceptor.USER_ROLE)
                .toString().toUpperCase();
        String query = "SELECT t.id,t.course_id,c.name AS course_name,"
                + "c.code AS course_code,u.name AS instructor,"
                + "t.day_of_week,TO_CHAR(t.start_time,'HH24:MI') AS start_time,"
                + "TO_CHAR(t.end_time,'HH24:MI') AS end_time,t.classroom "
                + "FROM timetable_entries t "
                + "JOIN courses c ON c.id=t.course_id "
                + "LEFT JOIN users u ON u.id=c.teacher_id ";

        if ("STUDENT".equals(role)) {
            return db.queryForList(
                    query + "JOIN enrollments e ON e.course_id=c.id "
                            + "WHERE e.student_id=? "
                            + "ORDER BY CASE t.day_of_week "
                            + "WHEN 'MONDAY' THEN 1 WHEN 'TUESDAY' THEN 2 "
                            + "WHEN 'WEDNESDAY' THEN 3 WHEN 'THURSDAY' THEN 4 "
                            + "WHEN 'FRIDAY' THEN 5 WHEN 'SATURDAY' THEN 6 "
                            + "ELSE 7 END,t.start_time,c.name",
                    userId);
        }
        if ("TEACHER".equals(role) || "INSTRUCTOR".equals(role)) {
            return db.queryForList(
                    query + "WHERE c.teacher_id=? "
                            + "ORDER BY CASE t.day_of_week "
                            + "WHEN 'MONDAY' THEN 1 WHEN 'TUESDAY' THEN 2 "
                            + "WHEN 'WEDNESDAY' THEN 3 WHEN 'THURSDAY' THEN 4 "
                            + "WHEN 'FRIDAY' THEN 5 WHEN 'SATURDAY' THEN 6 "
                            + "ELSE 7 END,t.start_time,c.name",
                    userId);
        }
        return db.queryForList(
                query + "ORDER BY CASE t.day_of_week "
                        + "WHEN 'MONDAY' THEN 1 WHEN 'TUESDAY' THEN 2 "
                        + "WHEN 'WEDNESDAY' THEN 3 WHEN 'THURSDAY' THEN 4 "
                        + "WHEN 'FRIDAY' THEN 5 WHEN 'SATURDAY' THEN 6 "
                        + "ELSE 7 END,t.start_time,c.name");
    }

    @PostMapping("/courses/{courseId}/timetable")
    @Transactional
    public ResponseEntity<?> createTimetableEntry(
            @PathVariable Long courseId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        Long teacherId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());
        ResponseEntity<?> validationError =
                validateTimetableEntry(courseId, body, teacherId, null);
        if (validationError != null) return validationError;

        DayOfWeek day = DayOfWeek.valueOf(value(body, "dayOfWeek").toUpperCase());
        LocalTime start = LocalTime.parse(value(body, "startTime"));
        LocalTime end = LocalTime.parse(value(body, "endTime"));
        Long entryId = db.queryForObject(
                "INSERT INTO timetable_entries "
                        + "(course_id,day_of_week,start_time,end_time,classroom,created_by) "
                        + "VALUES (?,?,?,?,?,?) RETURNING id",
                Long.class, courseId, day.name(), start, end,
                value(body, "classroom").isBlank()
                        ? null : value(body, "classroom"),
                teacherId);
        Map<String, Object> result = new HashMap<>();
        result.put("id", entryId);
        result.put("message", "Timetable class added.");
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/timetable/{entryId}")
    @Transactional
    public ResponseEntity<?> updateTimetableEntry(
            @PathVariable Long entryId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        Long teacherId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());
        Long courseId = number(body, "courseId");
        if (courseId == null) {
            return error("A course is required.", HttpStatus.BAD_REQUEST);
        }
        ResponseEntity<?> validationError =
                validateTimetableEntry(courseId, body, teacherId, entryId);
        if (validationError != null) return validationError;

        DayOfWeek day = DayOfWeek.valueOf(value(body, "dayOfWeek").toUpperCase());
        LocalTime start = LocalTime.parse(value(body, "startTime"));
        LocalTime end = LocalTime.parse(value(body, "endTime"));
        db.update(
                "UPDATE timetable_entries SET course_id=?,day_of_week=?,"
                        + "start_time=?,end_time=?,classroom=? WHERE id=?",
                courseId, day.name(), start, end,
                value(body, "classroom").isBlank()
                        ? null : value(body, "classroom"),
                entryId);
        return ResponseEntity.ok(message("Timetable class updated."));
    }

    @DeleteMapping("/timetable/{entryId}")
    @Transactional
    public ResponseEntity<?> deleteTimetableEntry(
            @PathVariable Long entryId) {
        int deleted = db.update(
                "DELETE FROM timetable_entries WHERE id=?", entryId);
        if (deleted == 0) {
            return error("Timetable class was not found.", HttpStatus.NOT_FOUND);
        }
        return ResponseEntity.ok(message("Timetable class removed."));
    }

    private ResponseEntity<?> validateTimetableEntry(
            Long courseId,
            Map<String, Object> body,
            Long teacherId,
            Long entryId) {
        Integer ownedCourse = db.queryForObject(
                "SELECT COUNT(*) FROM courses WHERE id=? AND teacher_id=?",
                Integer.class, courseId, teacherId);
        if (ownedCourse == null || ownedCourse == 0) {
            return error(
                    "You can only schedule classes for courses assigned to you.",
                    HttpStatus.FORBIDDEN);
        }

        DayOfWeek day;
        LocalTime start;
        LocalTime end;
        try {
            day = DayOfWeek.valueOf(value(body, "dayOfWeek").toUpperCase());
            start = LocalTime.parse(value(body, "startTime"));
            end = LocalTime.parse(value(body, "endTime"));
        } catch (IllegalArgumentException | DateTimeParseException e) {
            return error(
                    "Choose a valid weekday and enter times in HH:mm format.",
                    HttpStatus.BAD_REQUEST);
        }
        if (!start.isBefore(end)) {
            return error(
                    "Class end time must be later than its start time.",
                    HttpStatus.BAD_REQUEST);
        }
        String classroom = value(body, "classroom");
        if (classroom.length() > 120) {
            return error(
                    "Classroom must be 120 characters or fewer.",
                    HttpStatus.BAD_REQUEST);
        }
        if (hasTimetableConflict(courseId, teacherId, day, start, end, entryId)) {
            return error(
                    "This class overlaps another timetable entry for you or your students.",
                    HttpStatus.CONFLICT);
        }
        return null;
    }

    private boolean hasTimetableConflict(
            Long courseId,
            Long teacherId,
            DayOfWeek day,
            LocalTime start,
            LocalTime end,
            Long entryId) {
        String exclusion = entryId == null ? "" : "AND t.id<>? ";
        String query = "SELECT COUNT(*) FROM timetable_entries t "
                + "JOIN courses other_course ON other_course.id=t.course_id "
                + "WHERE t.day_of_week=? AND t.start_time<? AND t.end_time>? "
                + exclusion
                + "AND (other_course.teacher_id=? OR EXISTS ("
                + "SELECT 1 FROM enrollments selected_enrollment "
                + "JOIN enrollments other_enrollment "
                + "ON other_enrollment.student_id=selected_enrollment.student_id "
                + "WHERE selected_enrollment.course_id=? "
                + "AND other_enrollment.course_id=other_course.id))";
        Object[] parameters = entryId == null
                ? new Object[] {day.name(), end, start, teacherId, courseId}
                : new Object[] {day.name(), end, start, entryId, teacherId, courseId};
        Integer conflicts = db.queryForObject(query, Integer.class, parameters);
        return conflicts != null && conflicts > 0;
    }

    @PostMapping("/courses/{courseId}/attendance")
    @Transactional
    public ResponseEntity<?> recordAttendance(
            @PathVariable Long courseId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        Long teacherId = Long.valueOf(
                request.getAttribute(ApiSessionInterceptor.USER_ID).toString());
        String dateText = value(body, "attendanceDate");
        Object rawRecords = body.get("records");

        LocalDate attendanceDate;
        try {
            attendanceDate = LocalDate.parse(dateText);
        } catch (Exception e) {
            return error(
                    "attendanceDate must use YYYY-MM-DD format.",
                    HttpStatus.BAD_REQUEST);
        }

        Integer ownedCourse = db.queryForObject(
                "SELECT COUNT(*) FROM courses WHERE id=? AND teacher_id=?",
                Integer.class, courseId, teacherId);
        if (ownedCourse == null || ownedCourse == 0) {
            return error(
                    "You can only record attendance for courses assigned to you.",
                    HttpStatus.FORBIDDEN);
        }

        if (!(rawRecords instanceof List<?> records) || records.isEmpty()) {
            return error(
                    "At least one student attendance record is required.",
                    HttpStatus.BAD_REQUEST);
        }

        Set<Long> seenStudentIds = new HashSet<>();
        for (Object record : records) {
            if (!(record instanceof Map<?, ?> fields)) {
                return error(
                        "Each attendance record must include studentId and status.",
                        HttpStatus.BAD_REQUEST);
            }

            Long studentId = numberValue(fields.get("studentId"));
            String status = fields.get("status") == null
                    ? "" : fields.get("status").toString().trim().toUpperCase();
            if (studentId == null
                    || !Set.of("PRESENT", "ABSENT", "LATE", "EXCUSED")
                            .contains(status)
                    || !seenStudentIds.add(studentId)) {
                return error(
                        "Attendance records require a unique student ID and a valid status.",
                        HttpStatus.BAD_REQUEST);
            }

            Integer enrolledStudent = db.queryForObject(
                    "SELECT COUNT(*) FROM enrollments e "
                            + "JOIN users u ON u.id=e.student_id "
                            + "WHERE e.course_id=? AND e.student_id=? "
                            + "AND u.role='STUDENT'",
                    Integer.class, courseId, studentId);
            if (enrolledStudent == null || enrolledStudent == 0) {
                return error(
                        "Every attendance student must be enrolled in this course.",
                        HttpStatus.BAD_REQUEST);
            }
        }

        for (Object record : records) {
            Map<?, ?> fields = (Map<?, ?>) record;
            Long studentId = numberValue(fields.get("studentId"));
            String status = fields.get("status").toString().trim().toUpperCase();
            db.update(
                    "INSERT INTO attendance "
                            + "(course_id,student_id,attendance_date,status,recorded_by) "
                            + "VALUES (?,?,?,?,?) "
                            + "ON CONFLICT (course_id,student_id,attendance_date) "
                            + "DO UPDATE SET status=EXCLUDED.status,recorded_by=EXCLUDED.recorded_by",
                    courseId, studentId, attendanceDate, status, teacherId);
        }

        return ResponseEntity.ok(
                message("Attendance recorded successfully."));
    }

@PostMapping("/assignments/{assignmentId}/complete")
public ResponseEntity<?> completeAssignment(
        @PathVariable Long assignmentId,
        @RequestBody Map<String, Object> body,
        HttpServletRequest request) {

    Long studentId = number(body, "studentId");
    Long authenticatedStudentId = Long.valueOf(
            request.getAttribute(ApiSessionInterceptor.USER_ID).toString());

    if (studentId == null) {
        return error("studentId is required.", HttpStatus.BAD_REQUEST);
    }

    if (!authenticatedStudentId.equals(studentId)) {
        return error(
                "Students can only update their own assignment completion.",
                HttpStatus.FORBIDDEN);
    }

    Integer validStudent = db.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id=? AND role='STUDENT'",
            Integer.class, studentId);

    if (validStudent == null || validStudent == 0) {
        return error("Student not found.", HttpStatus.NOT_FOUND);
    }

    Integer validAssignment = db.queryForObject(
            "SELECT COUNT(*) FROM assignments WHERE id=?",
            Integer.class, assignmentId);

    if (validAssignment == null || validAssignment == 0) {
        return error("Assignment not found.", HttpStatus.NOT_FOUND);
    }

    Integer enrolled = db.queryForObject(
            "SELECT COUNT(*) FROM assignments a "
                    + "JOIN enrollments e ON e.course_id=a.course_id "
                    + "WHERE a.id=? AND e.student_id=?",
            Integer.class, assignmentId, studentId);
    if (enrolled == null || enrolled == 0) {
        return error(
                "Students can only complete assignments for courses they are enrolled in.",
                HttpStatus.FORBIDDEN);
    }

    db.update(
            "INSERT INTO assignment_completions (student_id, assignment_id) " +
            "VALUES (?, ?) ON CONFLICT (student_id, assignment_id) DO NOTHING",
            studentId, assignmentId);

    return ResponseEntity.ok(
            message("Assignment marked as completed."));
}

@GetMapping("/students/{studentId}/assignment-completions")
public List<Map<String, Object>> assignmentCompletions(
        @PathVariable Long studentId) {

    return db.queryForList(
            "SELECT assignment_id, completed_at " +
            "FROM assignment_completions WHERE student_id=?",
            studentId);
}

}