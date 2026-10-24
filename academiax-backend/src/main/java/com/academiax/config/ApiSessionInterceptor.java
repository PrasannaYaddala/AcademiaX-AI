package com.academiax.config;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class ApiSessionInterceptor implements HandlerInterceptor {

    public static final String USER_ID = "academiax.userId";
    public static final String USER_ROLE = "academiax.userRole";
    public static final String CSRF_TOKEN = "academiax.csrfToken";

    private static final Pattern STUDENT_RESOURCE = Pattern.compile(
            "^/api/(?:students/(\\d+)/(?:submissions|payments|assignment-completions|attendance)|enrollments/student/(\\d+))$");
    private static final Pattern COURSE_SUBMISSIONS = Pattern.compile(
            "^/api/courses/(\\d+)/submissions$");
    private static final Pattern COURSE_STUDENTS = Pattern.compile(
            "^/api/courses/(\\d+)/students$");
    private static final Pattern SUBMISSION_GRADE = Pattern.compile(
            "^/api/submissions/(\\d+)/grade$");
    private static final Pattern TIMETABLE_ENTRY = Pattern.compile(
            "^/api/timetable/(\\d+)$");
    private static final Pattern COURSE_TIMETABLE = Pattern.compile(
            "^/api/courses/(\\d+)/timetable$");

    private final JdbcTemplate db;

    public ApiSessionInterceptor(JdbcTemplate db) {
        this.db = db;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String path = request.getRequestURI();
        String method = request.getMethod();

        if (isPublic(path, method)) {
            return true;
        }

        HttpSession session = request.getSession(false);
        Object userId = session == null ? null : session.getAttribute(USER_ID);
        Object roleValue = session == null ? null : session.getAttribute(USER_ROLE);
        if (userId == null || roleValue == null) {
            return reject(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "Sign in is required.");
        }

        String role = roleValue.toString().toUpperCase();
        request.setAttribute(USER_ID, userId);
        request.setAttribute(USER_ROLE, role);

        if (isUnsafe(method) && !validCsrfToken(request, session)) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN,
                    "The request verification token is missing or invalid. Sign in again.");
        }

        if (!authorizeRole(method, path, role)) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN,
                    "Your account role is not allowed to perform this action.");
        }

        Matcher studentResource = STUDENT_RESOURCE.matcher(path);
        if (studentResource.matches()) {
            String requestedId = studentResource.group(1) != null
                    ? studentResource.group(1) : studentResource.group(2);
            if (!"STUDENT".equals(role) || !userId.toString().equals(requestedId)) {
                return reject(response, HttpServletResponse.SC_FORBIDDEN,
                        "You can only access your own student records.");
            }
        }

        Matcher courseSubmissions = COURSE_SUBMISSIONS.matcher(path);
        if ("GET".equalsIgnoreCase(method) && courseSubmissions.matches()
                && !ownsCourse(userId, courseSubmissions.group(1))) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN,
                    "You can only view submissions for courses assigned to you.");
        }

        Matcher courseAttendance = Pattern.compile(
                "^/api/courses/(\\d+)/attendance$").matcher(path);
        if (courseAttendance.matches()
                && !ownsCourse(userId, courseAttendance.group(1))) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN,
                    "You can only access attendance for courses assigned to you.");
        }

        Matcher courseStudents = COURSE_STUDENTS.matcher(path);
        if ("GET".equalsIgnoreCase(method) && courseStudents.matches()
                && !ownsCourse(userId, courseStudents.group(1))) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN,
                    "You can only view students enrolled in courses assigned to you.");
        }

        Matcher submissionGrade = SUBMISSION_GRADE.matcher(path);
        if ("PUT".equalsIgnoreCase(method) && submissionGrade.matches()
                && !ownsSubmission(userId, submissionGrade.group(1))) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN,
                    "You can only grade submissions for courses assigned to you.");
        }

        Matcher courseTimetable = COURSE_TIMETABLE.matcher(path);
        if ("POST".equalsIgnoreCase(method) && courseTimetable.matches()
                && !ownsCourse(userId, courseTimetable.group(1))) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN,
                    "You can only schedule classes for courses assigned to you.");
        }

        Matcher timetableEntry = TIMETABLE_ENTRY.matcher(path);
        if (timetableEntry.matches()
                && ("PUT".equalsIgnoreCase(method)
                        || "DELETE".equalsIgnoreCase(method))
                && !ownsTimetableEntry(userId, timetableEntry.group(1))) {
            return reject(response, HttpServletResponse.SC_FORBIDDEN,
                    "You can only change timetable entries for your courses.");
        }

        return true;
    }

    private boolean isPublic(String path, String method) {
        return ("GET".equalsIgnoreCase(method)
                        && ("/api/health/database".equals(path)
                                || "/api/auth/session".equals(path)))
                || ("POST".equalsIgnoreCase(method)
                        && ("/api/auth/login".equals(path)
                                || "/api/auth/register".equals(path)
                                || "/api/payments/webhook".equals(path)));
    }

    private boolean authorizeRole(String method, String path, String role) {
        if ("POST".equalsIgnoreCase(method)) {
            if ("/api/courses".equals(path) || "/api/assignments".equals(path)) {
                return "TEACHER".equals(role) || "INSTRUCTOR".equals(role);
            }
            if (path.matches("^/api/courses/\\d+/timetable$")) {
                return "TEACHER".equals(role) || "INSTRUCTOR".equals(role);
            }
            if (path.matches("^/api/courses/\\d+/attendance$")) {
                return "TEACHER".equals(role) || "INSTRUCTOR".equals(role);
            }
            if (path.matches("^/api/courses/\\d+/students$")) {
                return "TEACHER".equals(role) || "INSTRUCTOR".equals(role);
            }
            if ("/api/enrollments".equals(path)
                    || "/api/submissions".equals(path)
                    || path.matches("^/api/assignments/\\d+/complete$")
                    || "/api/payments/demo".equals(path)
                    || "/api/payments/checkout".equals(path)
                    || "/api/payments/verify".equals(path)) {
                return "STUDENT".equals(role);
            }
        }
        if ("PUT".equalsIgnoreCase(method)) {
            if (path.matches("^/api/submissions/\\d+/grade$")) {
                return "TEACHER".equals(role) || "INSTRUCTOR".equals(role);
            }
            if (path.matches("^/api/timetable/\\d+$")) {
                return "TEACHER".equals(role) || "INSTRUCTOR".equals(role);
            }
        }
        if ("DELETE".equalsIgnoreCase(method)
                && path.matches("^/api/timetable/\\d+$")) {
            return "TEACHER".equals(role) || "INSTRUCTOR".equals(role);
        }
        return true;
    }

    private boolean ownsCourse(Object userId, String courseId) {
        Integer count = db.queryForObject(
                "SELECT COUNT(*) FROM courses WHERE id=? AND teacher_id=?",
                Integer.class, Long.valueOf(courseId), Long.valueOf(userId.toString()));
        return count != null && count > 0;
    }

    private boolean ownsSubmission(Object userId, String submissionId) {
        Integer count = db.queryForObject(
                "SELECT COUNT(*) FROM submissions s "
                        + "JOIN assignments a ON a.id=s.assignment_id "
                        + "JOIN courses c ON c.id=a.course_id "
                        + "WHERE s.id=? AND c.teacher_id=?",
                Integer.class, Long.valueOf(submissionId),
                Long.valueOf(userId.toString()));
        return count != null && count > 0;
    }

    private boolean ownsTimetableEntry(Object userId, String entryId) {
        Integer count = db.queryForObject(
                "SELECT COUNT(*) FROM timetable_entries t "
                        + "JOIN courses c ON c.id=t.course_id "
                        + "WHERE t.id=? AND c.teacher_id=?",
                Integer.class, Long.valueOf(entryId),
                Long.valueOf(userId.toString()));
        return count != null && count > 0;
    }

    private boolean validCsrfToken(HttpServletRequest request, HttpSession session)
            throws Exception {
        Object expected = session.getAttribute(CSRF_TOKEN);
        String provided = request.getHeader("X-CSRF-Token");
        return expected != null && provided != null
                && MessageDigest.isEqual(
                        expected.toString().getBytes(StandardCharsets.UTF_8),
                        provided.getBytes(StandardCharsets.UTF_8));
    }

    private boolean isUnsafe(String method) {
        return !("GET".equalsIgnoreCase(method)
                || "HEAD".equalsIgnoreCase(method)
                || "OPTIONS".equalsIgnoreCase(method));
    }

    private boolean reject(
            HttpServletResponse response, int status, String message)
            throws Exception {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(
                "{\"message\":\"" + message.replace("\"", "\\\"") + "\"}");
        return false;
    }
}
