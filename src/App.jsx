import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  ClipboardList,
  FileCheck,
  CreditCard,
  ChartNoAxesColumn,
  UserRound,
  Bell,
  Menu,
  LogOut,
  CalendarDays,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Users,
  X,
  AlertTriangle,
  MapPin,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

import Auth from "./components/Auth.jsx";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "/api";

function getNumericId(value) {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const numericId = Number(value);
  return Number.isSafeInteger(numericId) && numericId > 0
    ? numericId
    : null;
}

function isDemoPayment(payment) {
  return (
    String(payment.description || "").startsWith("DEMO: ") ||
    String(payment.status || "").toUpperCase() === "PENDING"
  );
}

function getLetterGrade(value) {
  if (value == null || String(value).trim() === "") return null;
  const marks = Number(value);
  if (!Number.isFinite(marks) || marks < 0 || marks > 100) return null;
  if (marks >= 90) return "O";
  if (marks >= 80) return "A+";
  if (marks >= 70) return "A";
  if (marks >= 60) return "B+";
  if (marks >= 50) return "B";
  if (marks >= 40) return "C";
  return "F";
}

function getGradeColorClass(value) {
  const grade = getLetterGrade(value);
  return grade ? `grade-${grade.toLowerCase().replace("+", "-plus")}` : "grade-pending";
}

const TIMETABLE_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function formatTimetableTime(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value || "";
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

const studentMenu = [
  ["Dashboard", LayoutDashboard],
  ["My Courses", BookOpen],
  ["Course Catalog", GraduationCap],
  ["Assignments", ClipboardList],
  ["Attendance", CheckCircle2],
  ["Timetable", CalendarDays],
  ["Grades & Performance", ChartNoAxesColumn],
  ["Enrollment", FileCheck],
  ["Fee Payments", CreditCard],
  ["Student Submissions", FileCheck],
  ["Notifications", Bell],
  ["My Profile", UserRound],
];

const teacherMenu = [
  ["Dashboard", LayoutDashboard],
  ["My Courses", BookOpen],
  ["Manage Courses", BookOpen],
  ["Assignments", ClipboardList],
  ["Timetable", CalendarDays],
  ["Student Submissions", FileCheck],
  ["Grades", ChartNoAxesColumn],
  ["Attendance Management", CheckCircle2],
  ["Student Performance", ChartNoAxesColumn],
  ["Notifications", Bell],
  ["My Profile", UserRound],
];

const adminMenu = [
  ["Dashboard", LayoutDashboard],
  ["Manage Instructors", Users],
  ["Manage Courses", BookOpen],
  ["Payment Management", CreditCard],
  ["Academic Reports", ChartNoAxesColumn],
  ["My Profile", UserRound],
];

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [role, setRole] = useState("STUDENT");
  const [active, setActive] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [enrollmentRecords, setEnrollmentRecords] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState({
    description: "",
    amount: "",
  });
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceCourseId, setAttendanceCourseId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [courseStudents, setCourseStudents] = useState([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [gradingDrafts, setGradingDrafts] = useState({});
  const [editingGradeIds, setEditingGradeIds] = useState({});
  const [openSubmissionResponses, setOpenSubmissionResponses] = useState({});
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseDraft, setCourseDraft] = useState({
    code: "",
    name: "",
    description: "",
    capacity: "",
    enrollmentDeadline: "",
  });
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [openAssignmentId, setOpenAssignmentId] = useState(null);
  const [assignmentDraft, setAssignmentDraft] = useState({
    title: "",
    description: "",
    courseId: "",
    dueDate: "",
  });
  const [studentSubmissionDrafts, setStudentSubmissionDrafts] = useState({});
  const [timetableEntries, setTimetableEntries] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [showTimetableForm, setShowTimetableForm] = useState(false);
  const [editingTimetableId, setEditingTimetableId] = useState(null);
  const [savingTimetableEntry, setSavingTimetableEntry] = useState(false);
  const [timetableDraft, setTimetableDraft] = useState({
    courseId: "",
    dayOfWeek: "MONDAY",
    startTime: "",
    endTime: "",
    classroom: "",
  });
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState([]);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesLoadError, setCoursesLoadError] = useState("");
  const [enrollingCourseId, setEnrollingCourseId] = useState(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState(null);
  const [savingSubmissionId, setSavingSubmissionId] = useState(null);
  const [studentSubmissionsLoading, setStudentSubmissionsLoading] =
    useState(false);
  const [assignmentFilter, setAssignmentFilter] = useState("ALL");

  const isTeacher = role === "TEACHER" || role === "INSTRUCTOR";
  const notificationStorageKey = authUser?.id
    ? `academiax-dismissed-notifications-${role}-${authUser.id}`
    : null;

  const menu =
    role === "ADMIN"
      ? adminMenu
      : isTeacher
        ? teacherMenu
        : studentMenu;

  async function apiFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const method = String(options.method || "GET").toUpperCase();

    if (
      !["GET", "HEAD", "OPTIONS"].includes(method) &&
      authUser?.csrfToken
    ) {
      headers.set("X-CSRF-Token", authUser.csrfToken);
    }

    return fetch(url, {
      ...options,
      credentials: "include",
      headers,
    });
  }

  useEffect(() => {
    let cancelled = false;

    fetch(`${API}/auth/session`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) return null;
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || "Could not restore your session.");
        }
        return data;
      })
      .then((user) => {
        if (user && !cancelled) {
          setAuthUser(user);
          setRole(String(user.role || "STUDENT").toUpperCase());
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error.message || "Could not restore your session.");
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notificationStorageKey) {
      setDismissedNotificationIds([]);
      return;
    }

    setDismissedNotificationIds([]);
    try {
      const savedIds = JSON.parse(
        localStorage.getItem(notificationStorageKey) || "[]"
      );
      setDismissedNotificationIds(
        Array.isArray(savedIds)
          ? savedIds.filter((id) => typeof id === "string")
          : []
      );
    } catch {
      setDismissedNotificationIds([]);
      setMessage("Could not load your saved notification preferences.");
    }
  }, [notificationStorageKey]);

  function markNotificationAsSeen(notificationId) {
    if (!notificationStorageKey) return;

    try {
      const savedIds = JSON.parse(
        localStorage.getItem(notificationStorageKey) || "[]"
      );
      const nextIds = [
        ...new Set([
          ...(Array.isArray(savedIds)
            ? savedIds.filter((id) => typeof id === "string")
            : []),
          notificationId,
        ]),
      ];
      localStorage.setItem(notificationStorageKey, JSON.stringify(nextIds));
      setDismissedNotificationIds(nextIds);
    } catch {
      setMessage("Could not mark this notification as seen. Please try again.");
    }
  }

  useEffect(() => {
    if (!authUser?.id) return;

    loadCourses();
    loadAssignments();
    loadTimetable();

    if (role === "STUDENT") {
      loadStudentEnrollments(authUser.id);
      loadStudentSubmissions(authUser.id);
      loadStudentPayments(authUser.id);
      loadStudentAttendance(authUser.id);
    } else if (isTeacher) {
      loadInstructorSubmissions();
    }
  }, [authUser?.id, role]);

  function getCourseId(course) {
    return course.id ?? course.courseId ?? course.course_id;
  }

  function getAssignmentId(assignment) {
    return assignment.id ?? assignment.assignmentId ?? assignment.assignment_id;
  }

  function isCourseTaughtByCurrentTeacher(course) {
    if (!isTeacher) return false;

    const loggedInTeacherId = getNumericId(authUser?.id);
    const assignedTeacherId = getNumericId(course.teacher_id);

    return (
      loggedInTeacherId !== null &&
      assignedTeacherId !== null &&
      loggedInTeacherId === assignedTeacherId
    );
  }

  function getVisibleAssignments() {
    if (isTeacher) {
      const teacherCourseIds = courses
        .filter(isCourseTaughtByCurrentTeacher)
        .map(getCourseId)
        .filter((id) => id != null)
        .map(String);

      return assignments.filter((assignment) => {
        const courseId = assignment.course_id ?? assignment.courseId;
        return courseId != null && teacherCourseIds.includes(String(courseId));
      });
    }

    if (role === "STUDENT") {
      const enrolledIds = new Set(enrolledCourses.map(String));
      return assignments.filter((assignment) => {
        const courseId = assignment.course_id ?? assignment.courseId;
        return courseId != null && enrolledIds.has(String(courseId));
      });
    }

    return assignments;
  }

  function formatDate(dateValue) {
    if (!dateValue) return "Due date not provided";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function isAssignmentCompleted(assignment) {
    return Boolean(getSubmissionForAssignment(getAssignmentId(assignment)));
  }

  function getPendingAssignments() {
    return getVisibleAssignments()
      .filter(
        (assignment) =>
          !isAssignmentCompleted(assignment) &&
          getAssignmentId(assignment) != null
      )
      .sort((a, b) => {
        const dateA = new Date(
          a.dueDate ?? a.due_date ?? "9999-12-31"
        ).getTime();

        const dateB = new Date(
          b.dueDate ?? b.due_date ?? "9999-12-31"
        ).getTime();

        return dateA - dateB;
      });
  }

  function getDeadlineCounts() {
    const now = Date.now();
    const next48Hours = now + 48 * 60 * 60 * 1000;

    let overdue = 0;
    let dueSoon = 0;

    getPendingAssignments().forEach((assignment) => {
      const dueValue = assignment.dueDate ?? assignment.due_date;

      if (!dueValue) return;

      const dueTime = new Date(dueValue).getTime();

      if (Number.isNaN(dueTime)) return;

      if (dueTime < now) {
        overdue++;
      } else if (dueTime <= next48Hours) {
        dueSoon++;
      }
    });

    return { overdue, dueSoon };
  }

  function getCourseEnrollmentStatus(course) {
    const userId = String(authUser?.id ?? "");

    const enrolledStudentIds =
      course.enrolledStudentIds ??
      course.enrolled_student_ids ??
      course.studentIds ??
      course.student_ids;

    if (Array.isArray(enrolledStudentIds)) {
      return enrolledStudentIds.some((id) => String(id) === userId);
    }

    const enrolledUserIds = course.enrollments ?? course.enrolledStudents;

    if (Array.isArray(enrolledUserIds)) {
      return enrolledUserIds.some((enrollment) => {
        const studentId =
          enrollment.studentId ??
          enrollment.student_id ??
          enrollment.student?.id;

        return String(studentId) === userId;
      });
    }

    return false;
  }

  async function readResponse(response, fallbackMessage) {
    const text = await response.text();
    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      throw new Error(data.message || fallbackMessage);
    }

    return data;
  }

  async function loadCourses() {
    setCoursesLoading(true);
    setCoursesLoadError("");

    try {
      const response = await apiFetch(`${API}/courses`);
      const data = await readResponse(response, "Unable to load courses.");

      const courseList = Array.isArray(data) ? data : [];
      setCourses(courseList);

      const existingEnrollments = courseList
        .filter(getCourseEnrollmentStatus)
        .map(getCourseId)
        .filter((id) => id !== undefined && id !== null);

      if (existingEnrollments.length > 0) {
        setEnrolledCourses((previous) => [
          ...new Set([
            ...previous.map(String),
            ...existingEnrollments.map(String),
          ]),
        ]);
      }
      return courseList;
    } catch (error) {
      setCourses([]);
      setCoursesLoadError(
        error.message || "Could not load courses from the backend."
      );
      setMessage(
        error.message ||
          "Could not connect to the backend. Check that Spring Boot is running."
      );
      return null;
    } finally {
      setCoursesLoading(false);
    }
  }

  async function loadAssignments() {
    try {
      const response = await apiFetch(`${API}/assignments`);
      const data = await readResponse(
        response,
        "Unable to load assignments."
      );

      setAssignments(Array.isArray(data) ? data : []);
      return true;
    } catch (error) {
      setMessage(error.message || "Could not load assignments.");
      return false;
    }
  }

  async function loadStudentEnrollments(studentId) {
    try {
      const response = await apiFetch(
        `${API}/enrollments/student/${studentId}`
      );

      const data = await readResponse(
        response,
        "Could not load student enrollments."
      );

      const records = Array.isArray(data)
        ? data.filter(
            (item) =>
              item.course_id != null || item.courseId != null
          )
        : [];

      setEnrollmentRecords(records);
      setEnrolledCourses(
        records.map((item) => item.course_id ?? item.courseId)
      );
      return true;
    } catch (error) {
      console.error("Loading enrollments failed:", error);
      setMessage(error.message || "Could not load enrolled courses.");
      return false;
    }
  }

  async function loadStudentPayments(studentId) {
    if (studentId == null) return;

    setPaymentsLoading(true);
    try {
      const response = await apiFetch(
        `${API}/students/${studentId}/payments`
      );
      const data = await readResponse(
        response,
        "Could not load payment history."
      );
      setPayments(Array.isArray(data) ? data : []);
      return true;
    } catch (error) {
      console.error("Loading student payments failed:", error);
      setMessage(error.message || "Could not load payment history.");
      return false;
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function createDemoPayment(event) {
    event.preventDefault();

    if (!authUser?.id) {
      setMessage("Please sign in again to create a demo record.");
      return;
    }

    const amount = Number(paymentDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("Enter a valid amount greater than zero.");
      return;
    }
    if (!paymentDraft.description.trim()) {
      setMessage("Enter a payment description.");
      return;
    }

    setSavingPayment(true);
    setMessage("");
    try {
      const response = await apiFetch(`${API}/payments/demo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          description: paymentDraft.description.trim(),
        }),
      });
      const data = await readResponse(
        response,
        "Could not create the demo payment record."
      );
      setPaymentDraft({ description: "", amount: "" });
      const refreshed = await loadStudentPayments(authUser.id);
      setMessage(
        refreshed
          ? data.message || "Demo payment record created."
          : "Demo record created, but payment history could not be refreshed."
      );
    } catch (error) {
      setMessage(error.message || "Could not create the demo payment record.");
      console.error("Creating demo payment record failed:", error);
    } finally {
      setSavingPayment(false);
    }
  }

  async function loadStudentAttendance(studentId) {
    if (studentId == null) return;
    setAttendanceLoading(true);
    try {
      const response = await apiFetch(
        `${API}/students/${studentId}/attendance`
      );
      const data = await readResponse(
        response,
        "Could not load attendance records."
      );
      setAttendanceRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Loading student attendance failed:", error);
      setMessage(error.message || "Could not load attendance records.");
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function loadTimetable() {
    setTimetableLoading(true);
    try {
      const response = await apiFetch(`${API}/timetable`);
      const data = await readResponse(response, "Could not load timetable.");
      setTimetableEntries(Array.isArray(data) ? data : []);
      return true;
    } catch (error) {
      setMessage(error.message || "Could not load timetable.");
      return false;
    } finally {
      setTimetableLoading(false);
    }
  }

  function resetTimetableForm() {
    setTimetableDraft({
      courseId: "",
      dayOfWeek: "MONDAY",
      startTime: "",
      endTime: "",
      classroom: "",
    });
    setEditingTimetableId(null);
    setShowTimetableForm(false);
  }

  async function saveTimetableEntry(event) {
    event.preventDefault();
    if (!timetableDraft.courseId) {
      setMessage("Select a course for this timetable class.");
      return;
    }
    if (timetableDraft.startTime >= timetableDraft.endTime) {
      setMessage("Class end time must be later than its start time.");
      return;
    }

    setSavingTimetableEntry(true);
    setMessage("");
    try {
      const editing = editingTimetableId != null;
      const url = editing
        ? `${API}/timetable/${encodeURIComponent(editingTimetableId)}`
        : `${API}/courses/${encodeURIComponent(timetableDraft.courseId)}/timetable`;
      const response = await apiFetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(timetableDraft),
      });
      const data = await readResponse(response, "Could not save timetable class.");
      await loadTimetable();
      resetTimetableForm();
      setMessage(data.message || "Timetable class saved.");
    } catch (error) {
      setMessage(error.message || "Could not save timetable class.");
    } finally {
      setSavingTimetableEntry(false);
    }
  }

  function editTimetableEntry(entry) {
    setTimetableDraft({
      courseId: String(entry.course_id ?? ""),
      dayOfWeek: String(entry.day_of_week ?? "MONDAY").toUpperCase(),
      startTime: String(entry.start_time ?? "").slice(0, 5),
      endTime: String(entry.end_time ?? "").slice(0, 5),
      classroom: entry.classroom || "",
    });
    setEditingTimetableId(entry.id);
    setShowTimetableForm(true);
    setMessage("");
  }

  async function deleteTimetableEntry(entry) {
    if (!window.confirm(`Remove the ${entry.course_name || "class"} timetable entry?`)) {
      return;
    }

    setMessage("");
    try {
      const response = await apiFetch(
        `${API}/timetable/${encodeURIComponent(entry.id)}`,
        { method: "DELETE" }
      );
      const data = await readResponse(response, "Could not remove timetable class.");
      await loadTimetable();
      setMessage(data.message || "Timetable class removed.");
    } catch (error) {
      setMessage(error.message || "Could not remove timetable class.");
    }
  }

  async function loadTeacherCourseStudents(courseId) {
    if (courseId == null || courseId === "") {
      setCourseStudents([]);
      setAttendanceRecords([]);
      return;
    }

    setAttendanceLoading(true);
    setAttendanceRecords([]);
    try {
      const [studentsResponse, attendanceResponse] = await Promise.all([
        apiFetch(`${API}/courses/${courseId}/students`),
        apiFetch(`${API}/courses/${courseId}/attendance`),
      ]);
      const [studentsData, attendanceData] = await Promise.all([
        readResponse(studentsResponse, "Could not load enrolled students."),
        readResponse(attendanceResponse, "Could not load course attendance."),
      ]);
      setCourseStudents(Array.isArray(studentsData) ? studentsData : []);
      setAttendanceRecords(
        Array.isArray(attendanceData) ? attendanceData : []
      );
      setAttendanceStatuses({});
    } catch (error) {
      setMessage(error.message || "Could not load course attendance.");
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function saveAttendance(event) {
    event.preventDefault();
    if (!attendanceCourseId || courseStudents.length === 0) {
      setMessage("Select a course with enrolled students.");
      return;
    }
    if (
      attendanceRecords.some(
        (record) =>
          String(record.course_id) === String(attendanceCourseId) &&
          String(record.attendance_date).slice(0, 10) === attendanceDate
      )
    ) {
      setMessage("Attendance has already been saved for this course and date.");
      return;
    }

    const records = courseStudents.map((student) => ({
      studentId: student.id,
      status:
        attendanceStatuses[String(student.id)] ||
        attendanceRecords.find(
          (record) =>
            String(record.student_id) === String(student.id) &&
            String(record.attendance_date).slice(0, 10) === attendanceDate
        )?.status ||
        "",
    }));
    if (records.some((record) => !record.status)) {
      setMessage("Select an attendance status for each student.");
      return;
    }

    setSavingAttendance(true);
    setMessage("");
    try {
      const response = await apiFetch(
        `${API}/courses/${attendanceCourseId}/attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attendanceDate, records }),
        }
      );
      const data = await readResponse(
        response,
        "Could not save attendance."
      );
      await loadTeacherCourseStudents(attendanceCourseId);
      setMessage(data.message || "Attendance recorded successfully.");
    } catch (error) {
      setMessage(error.message || "Could not save attendance.");
    } finally {
      setSavingAttendance(false);
    }
  }

  // Students can view their own submissions.
  async function loadStudentSubmissions(studentId) {
    if (studentId == null) {
      setMessage("Student ID is missing. Please sign in again.");
      return;
    }

    setStudentSubmissionsLoading(true);
    setMessage("");

    try {
      const response = await apiFetch(
        `${API}/students/${studentId}/submissions`
      );

      const data = await readResponse(
        response,
        "Could not load saved submissions."
      );

      setStudentSubmissions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Loading student submissions failed:", error);
      setMessage(error.message || "Could not load assignment submissions.");
    } finally {
      setStudentSubmissionsLoading(false);
    }
  }

  // Teachers load submissions for the courses returned by the backend.
  async function loadInstructorSubmissions() {
    setLoading(true);
    setMessage("");

    try {
      const coursesResponse = await apiFetch(`${API}/courses`);
      const courseData = await readResponse(
        coursesResponse,
        "Unable to load courses."
      );

      const courseList = Array.isArray(courseData)
        ? courseData.filter(isCourseTaughtByCurrentTeacher)
        : [];

      const results = await Promise.all(
        courseList.map(async (course) => {
          const courseId = getCourseId(course);

          if (courseId == null) return [];

          try {
            const response = await apiFetch(
              `${API}/courses/${courseId}/submissions`
            );

            const data = await readResponse(
              response,
              `Unable to load submissions for course ${courseId}.`
            );

            if (!Array.isArray(data)) return [];

            return data.map((submission) => ({
              ...submission,
              course_name:
                submission.course_name ||
                submission.courseName ||
                course.name ||
                course.title ||
                course.code ||
                course.course_code ||
                `Course ${courseId}`,
            }));
          } catch (error) {
            console.error(
              `Could not load submissions for course ${courseId}:`,
              error
            );
            return [];
          }
        })
      );

      const combined = results.flat();
      setStudentSubmissions(combined);
      setGradingDrafts({});

      if (combined.length === 0) {
        setMessage(
          "No saved submissions found. Students must submit their assignments first."
        );
      }
    } catch (error) {
      console.error("Loading instructor submissions failed:", error);
      setStudentSubmissions([]);
      setMessage(error.message || "Could not load instructor submissions.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubmissionsForCurrentRole() {
    if (role === "STUDENT") {
      await loadStudentSubmissions(authUser?.id);
    } else if (isTeacher) {
      await loadInstructorSubmissions();
    } else {
      setMessage("Submission viewing is not configured for this role.");
    }
  }

  function updateGradingDraft(submissionId, field, value) {
    const draftKey = String(submissionId);

    setGradingDrafts((previous) => ({
      ...previous,
      [draftKey]: {
        ...previous[draftKey],
        [field]: value,
      },
    }));
  }

  async function saveSubmissionGrade(submissionId, savedGrade) {
    if (submissionId == null) {
      setMessage("Submission ID is missing. Refresh submissions before grading.");
      return;
    }

    const draftKey = String(submissionId);
    const draft = gradingDrafts[draftKey] || {};
    const gradeValue = String(draft.grade ?? savedGrade ?? "").trim();
    const grade = Number(gradeValue);

    if (
      !gradeValue ||
      !Number.isFinite(grade) ||
      grade < 0 ||
      grade > 100
    ) {
      setMessage("Enter a valid grade between 0 and 100.");
      return;
    }

    setSavingSubmissionId(submissionId);
    setMessage("");

    try {
      const response = await apiFetch(
        `${API}/submissions/${encodeURIComponent(submissionId)}/grade`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grade,
            feedback: "",
          }),
        }
      );

      await readResponse(
        response,
        "Could not save grade."
      );

      setStudentSubmissions((previous) =>
        previous.map((submission) => {
          const currentId =
            submission.id ??
            submission.submission_id ??
            submission.submissionId;

          return String(currentId) === String(submissionId)
            ? { ...submission, grade, feedback: null }
            : submission;
        })
      );

      setGradingDrafts((previous) => {
        const next = { ...previous };
        delete next[draftKey];
        return next;
      });
      setEditingGradeIds((previous) => ({
        ...previous,
        [draftKey]: false,
      }));
      setMessage("Marks saved successfully.");
    } catch (error) {
      setMessage(error.message || "Could not save grade.");
    } finally {
      setSavingSubmissionId(null);
    }
  }

  async function refreshStudentAssignmentData(studentId) {
    await Promise.all([
      loadAssignments(),
      loadStudentSubmissions(studentId),
    ]);
  }

  async function refreshAssignmentsForCurrentRole() {
    if (role === "STUDENT" && authUser?.id != null) {
      await loadStudentEnrollments(authUser.id);
      await refreshStudentAssignmentData(authUser.id);
      return;
    }

    if (isTeacher) {
      await loadCourses();
      await loadAssignments();
      return;
    }

    await loadAssignments();
  }

  function updateAssignmentDraft(field, value) {
    setAssignmentDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function updateCourseDraft(field, value) {
    setCourseDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function createCourse(event) {
    event.preventDefault();

    const teacherId = getNumericId(authUser?.id);
    const code = courseDraft.code.trim();
    const name = courseDraft.name.trim();
    const capacity = Number(courseDraft.capacity);

    if (!isTeacher || teacherId === null) {
      setMessage("Sign in with a valid teacher account to create a course.");
      return;
    }

    if (
      !code ||
      !name ||
      !Number.isSafeInteger(capacity) ||
      capacity < 1 ||
      capacity > 2147483647
    ) {
      setMessage("Enter a course code, name, and valid capacity.");
      return;
    }

    setCreatingCourse(true);
    setMessage("");

    try {
      const response = await apiFetch(`${API}/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          name,
          description: courseDraft.description.trim(),
          capacity,
          teacherId,
          enrollmentDeadline: courseDraft.enrollmentDeadline,
        }),
      });

      const data = await readResponse(response, "Could not create course.");
      const refreshedCourses = await loadCourses();

      setCourseDraft({
        code: "",
        name: "",
        description: "",
        capacity: "",
        enrollmentDeadline: "",
      });
      setShowCourseForm(false);

      if (refreshedCourses?.length > 0) {
        setMessage(data.message || "Course created successfully.");
      }
    } catch (error) {
      setMessage(error.message || "Could not create course.");
    } finally {
      setCreatingCourse(false);
    }
  }

  async function toggleAssignmentForm() {
    if (showAssignmentForm) {
      setShowAssignmentForm(false);
      return;
    }

    setShowAssignmentForm(true);
    await loadCourses();
  }

  async function createAssignment(event) {
    event.preventDefault();

    if (!isTeacher) {
      setMessage("Only teachers can create assignments.");
      return;
    }

    const selectedCourse = teacherCourses.find(
      (course) =>
        String(getCourseId(course)) === String(assignmentDraft.courseId)
    );
    const courseId = selectedCourse ? getCourseId(selectedCourse) : null;
    const title = assignmentDraft.title.trim();
    const dueDate = assignmentDraft.dueDate;
    const description = assignmentDraft.description.trim();

    if (courseId == null || !title || !description || !dueDate) {
      setMessage(
        "A course, title, assignment questions/instructions, and due date are required."
      );
      return;
    }

    setCreatingAssignment(true);
    setMessage("");

    try {
      const response = await apiFetch(`${API}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId,
          title,
          description,
          dueDate,
        }),
      });

      const data = await readResponse(
        response,
        "Could not create assignment."
      );

      const assignmentsReloaded = await loadAssignments();
      setAssignmentDraft({
        title: "",
        description: "",
        courseId: "",
        dueDate: "",
      });
      setShowAssignmentForm(false);
      if (assignmentsReloaded) {
        setMessage(data.message || "Assignment created.");
      }
    } catch (error) {
      setMessage(error.message || "Could not create assignment.");
    } finally {
      setCreatingAssignment(false);
    }
  }

  function getSubmissionForAssignment(assignmentId) {
    return studentSubmissions.find((submission) => {
      const submittedAssignmentId =
        submission.assignment_id ??
        submission.assignmentId ??
        submission.assignment?.id;

      return (
        submittedAssignmentId != null &&
        String(submittedAssignmentId) === String(assignmentId)
      );
    });
  }

  async function submitAssignment(assignment) {
    const assignmentId = getAssignmentId(assignment);
    const submissionText = String(
      studentSubmissionDrafts[String(assignmentId)] ?? ""
    ).trim();

    if (!authUser?.id) {
      setMessage("Please sign in again.");
      return;
    }

    if (assignmentId == null || !submissionText) {
      setMessage("Enter your assignment response before submitting.");
      return;
    }

    if (getSubmissionForAssignment(assignmentId)) {
      setMessage("This assignment has already been submitted.");
      return;
    }

    setSubmittingAssignmentId(assignmentId);
    setMessage("");

    try {
      const response = await apiFetch(`${API}/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignmentId,
          studentId: authUser.id,
          submissionText,
        }),
      });

      const data = await readResponse(
        response,
        "Could not submit assignment."
      );

      setStudentSubmissionDrafts((previous) => ({
        ...previous,
        [String(assignmentId)]: "",
      }));
      await loadStudentSubmissions(authUser.id);
      setMessage(data.message || "Assignment submitted successfully.");
    } catch (error) {
      setMessage(error.message || "Could not submit assignment.");
    } finally {
      setSubmittingAssignmentId(null);
    }
  }

  async function enrollInCourse(courseId) {
    if (!authUser?.id) {
      setMessage("Please sign in again.");
      return;
    }

    if (
      enrolledCourses.some((id) => String(id) === String(courseId))
    ) {
      setMessage("You are already enrolled in this course.");
      return;
    }

    setEnrollingCourseId(courseId);
    setMessage("");

    try {
      const response = await apiFetch(`${API}/enrollments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId: authUser.id,
          courseId,
        }),
      });

      const data = await readResponse(response, "Enrollment failed.");
      setEnrolledCourses((previous) => [
        ...new Set([...previous.map(String), String(courseId)]),
      ]);
      const [refreshedCourses, refreshedEnrollments] = await Promise.all([
        loadCourses(),
        loadStudentEnrollments(authUser.id),
      ]);

      if (refreshedCourses === null || !refreshedEnrollments) {
        setMessage(
          `${data.message || "Enrollment successful."} Refresh the page if your course lists do not update.`
        );
        return;
      }

      setMessage(data.message || "Enrollment successful.");
    } catch (error) {
      await Promise.all([
        loadCourses(),
        authUser?.id ? loadStudentEnrollments(authUser.id) : Promise.resolve(),
      ]);
      setMessage(error.message || "Could not enroll in this course.");
    } finally {
      setEnrollingCourseId(null);
    }
  }

  async function navigate(page) {
    setActive(page);
    setMessage("");

    if (
      page === "Course Catalog" ||
      page === "Manage Courses" ||
      page === "My Courses" ||
      page === "Enrollment"
    ) {
      await loadCourses();

      if (role === "STUDENT" && authUser?.id) {
        await loadStudentEnrollments(authUser.id);
      }
    }

    if (page === "Assignments") {
      await refreshAssignmentsForCurrentRole();
    }

    if (page === "Dashboard") {
      if (role === "STUDENT" && authUser?.id) {
        await refreshStudentAssignmentData(authUser.id);
      } else {
        await loadAssignments();
      }
    }

    // Important: load submissions based on the signed-in role.
    if (page === "Student Submissions") {
      await loadSubmissionsForCurrentRole();
    }

    if (page === "Grades & Performance" && role === "STUDENT") {
      await loadStudentSubmissions(authUser?.id);
    }

    if (page === "Fee Payments" && role === "STUDENT") {
      await loadStudentPayments(authUser?.id);
    }

    if (page === "Attendance" && role === "STUDENT") {
      await loadStudentAttendance(authUser?.id);
    }

    if (page === "Timetable") {
      if (isTeacher) await loadCourses();
      await loadTimetable();
    }

    if (page === "Attendance Management" && isTeacher) {
      await loadCourses();
      if (attendanceCourseId) {
        await loadTeacherCourseStudents(attendanceCourseId);
      }
    }

    if (page === "Grades" || page === "Student Performance") {
      if (isTeacher) await loadSubmissionsForCurrentRole();
    }

    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }

  function handleLogin(user) {
    const signedInUser = {
      ...user,
      role: String(user.role || "STUDENT").toUpperCase(),
    };

    setAuthUser(signedInUser);
    setRole(signedInUser.role);
    setActive("Dashboard");
    setMessage("");
    setCourses([]);
    setAssignments([]);
    setEnrolledCourses([]);
    setEnrollmentRecords([]);
    setStudentSubmissions([]);
    setPayments([]);
    setPaymentDraft({ description: "", amount: "" });
    setAttendanceRecords([]);
    setCourseStudents([]);
    setTimetableEntries([]);
    setGradingDrafts({});
    setStudentSubmissionDrafts({});
    setAssignmentFilter("ALL");
    setShowAssignmentForm(false);
    setShowCourseForm(false);
    setCourseDraft({
      code: "",
      name: "",
      description: "",
      capacity: "",
      enrollmentDeadline: "",
    });
    setAssignmentDraft({
      title: "",
      description: "",
      courseId: "",
      dueDate: "",
    });
    setSidebarOpen(true);

  }

  async function handleLogout() {
    try {
      await apiFetch(`${API}/auth/logout`, { method: "POST" });
    } catch (error) {
      console.error("Signing out failed:", error);
    }

    setAuthUser(null);
    setRole("STUDENT");
    setActive("Dashboard");
    setMessage("");
    setCourses([]);
    setAssignments([]);
    setEnrolledCourses([]);
    setEnrollmentRecords([]);
    setStudentSubmissions([]);
    setPayments([]);
    setPaymentDraft({ description: "", amount: "" });
    setAttendanceRecords([]);
    setCourseStudents([]);
    setTimetableEntries([]);
    setGradingDrafts({});
    setStudentSubmissionDrafts({});
    setAssignmentFilter("ALL");
    setShowAssignmentForm(false);
    setShowCourseForm(false);
    setCourseDraft({
      code: "",
      name: "",
      description: "",
      capacity: "",
      enrollmentDeadline: "",
    });
    setAssignmentDraft({
      title: "",
      description: "",
      courseId: "",
      dueDate: "",
    });
    setSidebarOpen(true);
  }

  if (!authUser) {
    if (authChecking) {
      return (
        <main className="auth-loading">
          <div className="brand-logo">
            <GraduationCap size={25} />
          </div>
          <p>Restoring your secure AcademiaX session...</p>
        </main>
      );
    }
    return <Auth onAuthSuccess={handleLogin} />;
  }

  const displayName = authUser.name || authUser.email || role;
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const profileRoleLabel =
    role === "STUDENT"
      ? "Student"
      : role === "TEACHER"
        ? "Teacher"
        : "Administrator";
  const profileDetails = [
    { label: "Full name", value: authUser.name },
    { label: "Email address", value: authUser.email },
    { label: "Account type", value: profileRoleLabel },
    { label: "Account ID", value: authUser.id },
    {
      label: "Department / Branch",
      value:
        authUser.department ||
        authUser.branch ||
        authUser.departmentName ||
        authUser.branchName,
    },
    ...(role === "STUDENT"
      ? [
          {
            label: "Year of study",
            value: authUser.yearOfStudy ?? authUser.year_of_study,
          },
          {
            label: "Semester",
            value: authUser.semester,
          },
        ]
      : []),
  ].filter(
    (detail) =>
      detail.value != null && String(detail.value).trim() !== ""
  );

  const myCourses = courses.filter((course) =>
    enrolledCourses.some(
      (id) => String(id) === String(getCourseId(course))
    )
  );

  const teacherCourses = courses.filter(isCourseTaughtByCurrentTeacher);
  const isTeacherCourseManagement = isTeacher && active === "Manage Courses";
  const visibleAssignments = getVisibleAssignments();
  const pendingAssignments = getPendingAssignments();

  const completedCount = visibleAssignments.filter((assignment) =>
    isAssignmentCompleted(assignment)
  ).length;

  const pendingCount = pendingAssignments.length;

  const deadlineCounts = getDeadlineCounts();

  const filteredAssignments = visibleAssignments.filter((assignment) => {
    const completed = isAssignmentCompleted(assignment);

    if (assignmentFilter === "COMPLETED") return completed;
    if (assignmentFilter === "PENDING") return !completed;

    return true;
  });

  const gradeResults = studentSubmissions.map((submission) => {
    const rawGrade = submission.grade;
    const gradeText = rawGrade == null ? "" : String(rawGrade).trim();
    const parsedGrade = gradeText === "" ? null : Number(gradeText);
    const validGrade =
      parsedGrade !== null &&
      Number.isFinite(parsedGrade) &&
      parsedGrade >= 0 &&
      parsedGrade <= 100
        ? parsedGrade
        : null;

    return {
      assignment:
        submission.assignment_title ||
        submission.assignmentTitle ||
        `Assignment #${
          submission.assignment_id ?? submission.assignmentId ?? ""
        }`,
      course: submission.course_name || submission.courseName || "—",
      grade: validGrade,
      letterGrade: getLetterGrade(validGrade),
    };
  });
  const gradedResults = gradeResults.filter((result) => result.grade !== null);
  const gradeAverage =
    gradedResults.length === 0
      ? null
      : gradedResults.reduce((total, result) => total + result.grade, 0) /
        gradedResults.length;
  const pendingGradeCount = gradeResults.length - gradedResults.length;
  const presentAttendanceCount = attendanceRecords.filter((record) =>
    ["PRESENT", "LATE"].includes(
      String(record.status || "").toUpperCase()
    )
  ).length;
  const attendancePercentage =
    attendanceRecords.length === 0
      ? null
      : (presentAttendanceCount / attendanceRecords.length) * 100;
  const attendanceDateHasRecords = attendanceRecords.some(
    (record) =>
      String(record.course_id) === String(attendanceCourseId) &&
      String(record.attendance_date).slice(0, 10) === attendanceDate
  );
  const demoPaymentRecords = payments.filter(isDemoPayment);
  const pendingPaymentRecords = payments.filter(
    (payment) =>
      String(payment.status || "").toUpperCase() === "PENDING" &&
      !isDemoPayment(payment)
  );
  const paidPaymentTotal = payments
    .filter((payment) => String(payment.status || "").toUpperCase() === "PAID")
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const pendingPaymentTotal = pendingPaymentRecords.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0
  );
  const demoPaymentTotal = demoPaymentRecords.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0
  );
  const latestGradedSubmission = [...studentSubmissions]
    .filter((submission) => {
      const grade = Number(submission.grade);
      return (
        submission.grade != null &&
        String(submission.grade).trim() !== "" &&
        Number.isFinite(grade) &&
        grade >= 0 &&
        grade <= 100
      );
    })
    .sort(
      (first, second) =>
        new Date(second.graded_at ?? second.gradedAt ?? 0).getTime() -
        new Date(first.graded_at ?? first.gradedAt ?? 0).getTime()
    )[0];
  const teacherPendingSubmissions = studentSubmissions.filter(
    (submission) =>
      submission.grade == null || String(submission.grade).trim() === ""
  ).length;
  const visibleTeacherSubmissions = studentSubmissions.filter(
    (submission) =>
      submission.grade == null || String(submission.grade).trim() === ""
  );
  const teacherGradedSubmissions =
    studentSubmissions.length - teacherPendingSubmissions;
  const recommendedAssignment =
    role === "STUDENT"
      ? visibleAssignments
          .filter(
            (assignment) =>
              !getSubmissionForAssignment(getAssignmentId(assignment))
          )
          .sort((first, second) => {
            const firstDue = new Date(
              first.due_date ?? first.dueDate ?? "9999-12-31"
            ).getTime();
            const secondDue = new Date(
              second.due_date ?? second.dueDate ?? "9999-12-31"
            ).getTime();
            return firstDue - secondDue;
          })[0]
      : null;
  const recommendedCourse = recommendedAssignment
    ? courses.find(
        (course) =>
          String(getCourseId(course)) ===
          String(
            recommendedAssignment.course_id ??
              recommendedAssignment.courseId
          )
      )
    : null;
  const recommendedCourseCode =
    recommendedAssignment?.course_code ??
    recommendedAssignment?.courseCode ??
    recommendedCourse?.code ??
    recommendedCourse?.course_code ??
    "—";
  const studentNotifications = [
    ...getPendingAssignments()
      .filter((assignment) => {
        const due = new Date(
          assignment.due_date ?? assignment.dueDate ?? ""
        ).getTime();
        return Number.isFinite(due) && due - Date.now() <= 48 * 60 * 60 * 1000;
      })
      .map((assignment, index) => ({
        id: `deadline-${getAssignmentId(assignment) ?? `${assignment.title || "assignment"}-${index}`}`,
        title: `Assignment due: ${assignment.title || "Assignment"}`,
        detail: `Due ${formatDate(assignment.due_date ?? assignment.dueDate)}`,
        type: "deadline",
      })),
    ...studentSubmissions
      .filter(
        (submission) =>
          submission.grade != null &&
          String(submission.grade).trim() !== ""
      )
      .map((submission, index) => {
        const submissionId =
          submission.id ??
          submission.submission_id ??
          submission.submissionId ??
          submission.assignment_id ??
          submission.assignmentId ??
          `${submission.student_id ?? submission.studentId ?? "student"}-${
            submission.assignment_title || submission.assignmentTitle || index
          }`;
        const gradeValue = String(submission.grade).trim();
        return {
          id: `grade-${submissionId}-${gradeValue}`,
          title: `Grade available: ${
            submission.assignment_title ||
            submission.assignmentTitle ||
            "Assignment"
          }`,
          detail: `Grade: ${submission.grade}`,
          type: "grade",
        };
      }),
    ...pendingPaymentRecords.map((payment, index) => ({
      id: `payment-${payment.id ?? payment.payment_id ?? `${payment.description || "payment"}-${payment.amount}-${index}`}`,
      title: "Payment reminder",
      detail: `${payment.description}: ₹${Number(payment.amount).toFixed(2)} is pending`,
      type: "payment",
    })),
  ];
  const teacherNotifications = studentSubmissions
    .filter(
      (submission) =>
        submission.grade == null || String(submission.grade).trim() === ""
    )
    .map((submission, index) => {
      const submissionId =
        submission.id ??
        submission.submission_id ??
        submission.submissionId ??
        submission.assignment_id ??
        submission.assignmentId ??
        `${submission.student_id ?? submission.studentId ?? "student"}-${
        submission.assignment_title || submission.assignmentTitle || index
        }`;
      return {
        id: `grading-${submissionId}`,
        title: "Submission awaiting grading",
        detail: `${submission.student_name || submission.studentName || submission.student_email || "A student"} · ${
          submission.assignment_title || submission.assignmentTitle || "Assignment"
        }`,
        type: "grading",
      };
    });
  const visibleStudentNotifications = studentNotifications.filter(
    (item) => !dismissedNotificationIds.includes(item.id)
  );
  const visibleTeacherNotifications = teacherNotifications.filter(
    (item) => !dismissedNotificationIds.includes(item.id)
  );
  const unreadNotificationCount =
    role === "STUDENT"
      ? visibleStudentNotifications.length
      : isTeacher
        ? visibleTeacherNotifications.length
        : 0;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "" : "sidebar-hidden"}`}>
        <div className="brand">
          <div className="brand-logo">
            <GraduationCap size={25} />
          </div>

          <div>
            <strong>AcademiaX</strong>
            <small>ACADEMIC PORTAL</small>
          </div>

          <button
            className="icon-button mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="role-switch">
          <label>PORTAL ROLE</label>
          <div className="current-role">
            <span>
              {role === "ADMIN"
                ? "Admin Portal"
                : isTeacher
                  ? "Teacher Portal"
                  : "Student Portal"}
            </span>
          </div>
        </div>

        <div className="menu-heading">WORKSPACE</div>

        <nav className="side-nav">
          {menu.map(([label, Icon]) => (
            <button
              key={label}
              className={`nav-item ${active === label ? "active" : ""}`}
              onClick={() => navigate(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="nav-item logout"
          onClick={handleLogout}
        >
          <LogOut size={18} />
          <span>Sign out / Switch account</span>
        </button>

        <div className="sidebar-bottom">
          <small className="version">ACADEMIAX · STUDENT SUCCESS</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            Workspace <span>/</span> <b>{active}</b>
          </div>

          <div className="top-actions">
            <button
              className="icon-button notification"
              aria-label="Notifications"
              type="button"
              onClick={() => navigate("Notifications")}
            >
              <Bell size={19} />
              {unreadNotificationCount > 0 && (
                <span className="notification-count">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              )}
            </button>

            <div className="avatar">{avatarLetter}</div>

            <div className="user-label">
              <b>{displayName}</b>
              <small>{role}</small>
            </div>

            <button
              type="button"
              className="icon-button"
              onClick={handleLogout}
              title="Sign out and switch account"
              aria-label="Sign out"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">YOUR ACADEMIC SPACE</div>

              <h1>
                {active === "Dashboard"
                  ? `Welcome, ${displayName}`
                  : active}
              </h1>

              <p>
                Learn, track your progress, and stay on top of your academic
                goals.
              </p>
            </div>

            <div className="date-pill">
              <CalendarDays size={16} />
              Academic Workspace
            </div>
          </div>

          {message && (
            <div
              className={`message ${
                active === "Attendance Management" &&
                /success|recorded/i.test(message)
                  ? "attendance-message-success"
                  : ""
              }`}
            >
              {message}
            </div>
          )}

          {loading && (
            <div className="message">
              Loading information from AcademiaX...
            </div>
          )}

          {active === "Dashboard" && isTeacher && (
            <>
              <div className="stats-grid teacher-dashboard-stats">
                <Stat
                  icon={BookOpen}
                  label="Assigned Courses"
                  value={teacherCourses.length}
                  color="blue"
                />
                <Stat
                  icon={ClipboardList}
                  label="Published Assignments"
                  value={visibleAssignments.length}
                  color="purple"
                />
                <Stat
                  icon={Clock}
                  label="Pending Submissions"
                  value={teacherPendingSubmissions}
                  color="orange"
                />
                <Stat
                  icon={CheckCircle2}
                  label="Graded Submissions"
                  value={teacherGradedSubmissions}
                  color="green"
                />
              </div>

            </>
          )}

          {active === "Dashboard" && role === "STUDENT" && (
            <>
              <div className="stats-grid student-dashboard-stats">
                <Stat
                  icon={BookOpen}
                  label="Enrolled Courses"
                  value={myCourses.length}
                  color="blue"
                />
                <Stat
                  icon={ClipboardList}
                  label="Pending Assignments"
                  value={pendingCount}
                  color="purple"
                />
                <Stat
                  icon={CheckCircle2}
                  label="Attendance"
                  value={
                    attendancePercentage === null
                      ? "—"
                      : `${attendancePercentage.toFixed(1)}%`
                  }
                  color="orange"
                  detail={
                    attendanceRecords.length === 0
                      ? "No attendance records"
                      : "From recorded classes"
                  }
                />
                <Stat
                  icon={CreditCard}
                  label="Recorded Pending Fees"
                  value={
                    payments.length === 0
                      ? "—"
                      : `₹${pendingPaymentTotal.toFixed(2)}`
                  }
                  color="green"
                  detail={
                    payments.length === 0
                      ? "No fee records configured"
                      : "Recorded pending payment items"
                  }
                />
                <Stat
                  icon={ChartNoAxesColumn}
                  label="Latest Performance"
                  value={
                    latestGradedSubmission
                      ? getLetterGrade(latestGradedSubmission.grade) || "—"
                      : "—"
                  }
                  color="blue"
                  detail={
                    latestGradedSubmission
                      ? `${Number(latestGradedSubmission.grade).toFixed(1)}% · ${
                          latestGradedSubmission.assignment_title ||
                          "Latest graded assignment"
                        }`
                      : "No saved grades yet"
                  }
                />
              </div>

            </>
          )}

          {(active === "Course Catalog" ||
            active === "Manage Courses" ||
            active === "My Courses" ||
            active === "Enrollment") && (
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {isTeacherCourseManagement
                      ? "Manage Courses"
                      : active}
                  </h2>
                  <p>
                    {isTeacherCourseManagement
                      ? "Create courses assigned to your teacher account and open assignment management."
                      : isTeacher && active === "My Courses"
                        ? "View courses assigned to your teacher account."
                      : active === "My Courses"
                        ? "Courses you have enrolled in"
                        : active === "Enrollment"
                          ? "Your saved enrollment records"
                      : "Courses available from your AcademiaX backend"}
                  </p>
                </div>

                <button
                  className="text-button"
                  onClick={async () => {
                    if (role === "STUDENT" && authUser?.id) {
                      await Promise.all([
                        loadCourses(),
                        loadStudentEnrollments(authUser.id),
                      ]);
                    } else {
                      await loadCourses();
                    }
                  }}
                >
                  Refresh <ArrowUpRight size={15} />
                </button>
              </div>

              {isTeacherCourseManagement && (
                <>
                  <button
                    type="button"
                    className="primary-button assignment-add-button"
                    disabled={getNumericId(authUser?.id) === null}
                    onClick={() => setShowCourseForm((visible) => !visible)}
                  >
                    {showCourseForm ? "Close Form" : "+ Create Course"}
                  </button>

                  {showCourseForm && (
                    <form className="assignment-form" onSubmit={createCourse}>
                      <label>
                        Course code
                        <input
                          type="text"
                          value={courseDraft.code}
                          onChange={(event) =>
                            updateCourseDraft("code", event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Course name
                        <input
                          type="text"
                          value={courseDraft.name}
                          onChange={(event) =>
                            updateCourseDraft("name", event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Capacity
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={courseDraft.capacity}
                          onChange={(event) =>
                            updateCourseDraft("capacity", event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Enrollment deadline
                        <input
                          type="datetime-local"
                          value={courseDraft.enrollmentDeadline}
                          onChange={(event) =>
                            updateCourseDraft(
                              "enrollmentDeadline",
                              event.target.value
                            )
                          }
                        />
                      </label>

                      <label className="assignment-form-wide">
                        Course description
                        <textarea
                          rows="3"
                          value={courseDraft.description}
                          onChange={(event) =>
                            updateCourseDraft("description", event.target.value)
                          }
                        />
                      </label>

                      <button
                        type="submit"
                        className="primary-button"
                        disabled={creatingCourse || coursesLoading}
                      >
                        {creatingCourse ? "Creating..." : "Create Course"}
                      </button>
                    </form>
                  )}
                </>
              )}

              {(() => {
                if (active === "Enrollment" && role === "STUDENT") {
                  return enrollmentRecords.length === 0 ? (
                    <div className="empty-state">
                      <FileCheck size={30} />
                      <p>You do not have any enrollment records yet.</p>
                      <button
                        className="primary-button"
                        onClick={() => navigate("Course Catalog")}
                      >
                        Browse Course Catalog <ArrowUpRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="course-grid">
                      {enrollmentRecords.map((record) => {
                        const courseId =
                          record.course_id ??
                          record.courseId ??
                          record.COURSE_ID;
                        const course = courses.find(
                          (item) =>
                            String(getCourseId(item)) === String(courseId)
                        );
                        const courseName =
                          record.course_name ??
                          record.courseName ??
                          record.COURSE_NAME ??
                          course?.name ??
                          course?.title;
                        const courseCode =
                          record.course_code ??
                          record.courseCode ??
                          record.COURSE_CODE ??
                          course?.code ??
                          course?.course_code;
                        const enrollmentDate =
                          record.enrollment_date ??
                          record.enrollmentDate ??
                          record.ENROLLMENT_DATE ??
                          record.enrolled_at ??
                          record.created_at;

                        return (
                          <div className="course-card" key={courseId}>
                            <div className="course-card-top">
                              <span className="course-code">
                                {courseCode || `COURSE ${courseId}`}
                              </span>
                              <FileCheck size={20} />
                            </div>
                            <h3>{courseName || `Course ${courseId}`}</h3>
                            <div className="course-meta">
                              <span>
                                <CalendarDays size={15} />
                                Enrolled:{" "}
                                {enrollmentDate
                                  ? formatDate(enrollmentDate)
                                  : "Date not recorded"}
                              </span>
                              <span>
                                <CheckCircle2 size={15} />
                                Status: {record.status || "ENROLLED"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                const displayedCourses =
                  isTeacher && ["Manage Courses", "My Courses"].includes(active)
                    ? teacherCourses
                    : active === "My Courses" && role === "STUDENT"
                      ? myCourses
                      : active === "Course Catalog" && role === "STUDENT"
                        ? courses.filter(
                            (course) =>
                              !enrolledCourses.some(
                                (id) =>
                                  String(id) ===
                                  String(getCourseId(course))
                              )
                          )
                      : courses;

                return displayedCourses.length === 0 ? (
                  <div className="empty-state">
                    <BookOpen size={30} />
                    <p>
                      {isTeacher && active === "My Courses"
                        ? "You do not have any courses assigned yet. Open Manage Courses to create one."
                        : isTeacherCourseManagement
                        ? "No courses are assigned to your teacher account yet. Create a course to assign it to your account."
                        : active === "My Courses"
                          ? "You have not enrolled in any courses yet."
                          : active === "Course Catalog"
                            ? "There are no courses available to enroll in right now."
                            : "No courses found."}
                    </p>

                    {active === "My Courses" && role === "STUDENT" && (
                      <button
                        className="primary-button"
                        onClick={() => navigate("Course Catalog")}
                      >
                        Browse Courses <ArrowUpRight size={16} />
                      </button>
                    )}
                    {isTeacher && active === "My Courses" && (
                      <button
                        className="primary-button"
                        onClick={() => navigate("Manage Courses")}
                      >
                        Open Course Management <ArrowUpRight size={16} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="course-grid">
                    {displayedCourses.map((course) => {
                      const courseId = getCourseId(course);
                      const courseCode = String(
                        course.code ?? course.course_code ?? ""
                      ).trim().toUpperCase();

                      const isEnrolled = enrolledCourses.some(
                        (id) => String(id) === String(courseId)
                      );

                      const capacity = Number(
                        course.capacity ?? course.total_capacity ?? 0
                      );

                      const enrolledCount = Number(
                        course.enrolled ?? course.enrolled_count ?? 0
                      );

                      const availableSeats = Number(
                        course.available_seats ??
                          course.availableSeats ??
                          Math.max(0, capacity - enrolledCount)
                      );

                      const isEnrolling =
                        String(enrollingCourseId) === String(courseId);

                      return (
                        <div className="course-card" key={courseId}>
                          <div className="course-card-top">
                            <span className="course-code">
                              {course.code ||
                                course.course_code ||
                                "COURSE"}
                            </span>
                            <BookOpen size={20} />
                          </div>

                          <h3>
                            {course.name ||
                              course.title ||
                              "Untitled Course"}
                          </h3>

                          <p>
                            {course.description || "Course description"}
                          </p>

                          <div className="course-meta">
                            {course.instructor && (
                              <span>
                                <UserRound size={15} />
                                Instructor: {course.instructor}
                              </span>
                            )}
                            <span>
                              <Users size={15} />
                              Capacity: {capacity || "—"}
                            </span>

                            <span>
                              <Users size={15} />
                              Available seats: {availableSeats}
                            </span>

                            <span>
                              <CalendarDays size={15} />
                              Deadline:{" "}
                              {formatDate(
                                course.enrollmentDeadline ??
                                  course.enrollment_deadline
                              )}
                            </span>
                          </div>

                          {!(isTeacher && active === "My Courses") && (
                          <button
                            className="primary-button"
                            disabled={
                              role === "STUDENT" &&
                              (isEnrolled || isEnrolling || availableSeats <= 0)
                            }
                            onClick={() => {
                              if (isTeacher && active === "Manage Courses") {
                                navigate("Assignments");
                                return;
                              }

                              if (role !== "STUDENT") {
                                setMessage("Choose a course management action.");
                                return;
                              }

                              enrollInCourse(courseId);
                            }}
                          >
                            {isTeacher && active === "Manage Courses"
                              ? "Manage Assignments"
                              : role !== "STUDENT"
                                ? "Manage Course"
                                : isEnrolled
                                  ? "Enrolled ✓"
                                  : isEnrolling
                                    ? "Enrolling..."
                                    : availableSeats <= 0
                                      ? "Course Full"
                                      : "View / Enroll"}

                            <ArrowUpRight size={16} />
                          </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {active === "Assignments" && (
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>{isTeacher ? "Assignment Management" : "Assignments"}</h2>
                  <p>
                    {isTeacher
                      ? "Create and review assignments for courses you teach"
                      : "Assignments for courses you are enrolled in"}
                  </p>
                </div>

                <button
                  type="button"
                  className="text-button"
                  onClick={refreshAssignmentsForCurrentRole}
                >
                  Refresh <ArrowUpRight size={15} />
                </button>
              </div>

              {isTeacher ? (
                <>
                  <button
                    type="button"
                    className="primary-button assignment-add-button"
                    onClick={toggleAssignmentForm}
                  >
                    {showAssignmentForm ? "Close Form" : "+ Create Assignment"}
                  </button>

                  {showAssignmentForm && (
                    <form className="assignment-form" onSubmit={createAssignment}>
                      <label>
                        Assignment title
                        <input
                          type="text"
                          value={assignmentDraft.title}
                          onChange={(event) =>
                            updateAssignmentDraft("title", event.target.value)
                          }
                          required
                        />
                      </label>

                      <label>
                        Course
                        <select
                          value={assignmentDraft.courseId}
                          disabled={coursesLoading || teacherCourses.length === 0}
                          onChange={(event) =>
                            updateAssignmentDraft("courseId", event.target.value)
                          }
                          required
                        >
                          <option value="">
                            {coursesLoading
                              ? "Loading courses..."
                              : "Select a course"}
                          </option>
                          {teacherCourses.map((course) => (
                            <option
                              key={getCourseId(course)}
                              value={getCourseId(course)}
                            >
                              {course.name || `Course ${getCourseId(course)}`}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Due date
                        <input
                          type="datetime-local"
                          value={assignmentDraft.dueDate}
                          onChange={(event) =>
                            updateAssignmentDraft("dueDate", event.target.value)
                          }
                          required
                        />
                      </label>

                      <label className="assignment-form-wide">
                        Assignment Questions / Instructions
                        <textarea
                          rows="3"
                        value={assignmentDraft.description}
                          onChange={(event) =>
                            updateAssignmentDraft(
                              "description",
                              event.target.value
                            )
                          }
                          required
                        />
                      </label>

                      <button
                        type="submit"
                        className="primary-button"
                        disabled={
                          creatingAssignment ||
                          coursesLoading ||
                          teacherCourses.length === 0
                        }
                      >
                        {creatingAssignment ? "Publishing..." : "Create Assignment"}
                      </button>

                      {coursesLoadError ? (
                        <small className="assignment-form-note assignment-form-error">
                          {coursesLoadError}
                        </small>
                      ) : !coursesLoading && teacherCourses.length === 0 ? (
                        <small className="assignment-form-note">
                          {courses.length === 0
                            ? "No courses are available from the backend."
                            : getNumericId(authUser?.id) === null
                              ? "Your login did not provide a valid numeric teacher ID. Sign out and sign in again."
                              : `No courses are assigned to teacher ID ${getNumericId(authUser.id)}.`}
                        </small>
                      ) : null}
                    </form>
                  )}

                  {visibleAssignments.length === 0 ? (
                    <div className="empty-state">
                      <ClipboardList size={30} />
                      <p>No assignments found for your courses.</p>
                    </div>
                  ) : (
                    visibleAssignments.map((assignment) => {
                      const assignmentId = getAssignmentId(assignment);
                      const isAssignmentOpen =
                        String(openAssignmentId) === String(assignmentId);
                      const questionsId = `assignment-questions-${assignmentId}`;

                      return (
                      <div className="assignment-row teacher-assignment-row" key={assignmentId}>
                        <div className="assignment-symbol">
                          <ClipboardList size={19} />
                        </div>
                        <div className="assignment-info">
                          <b>{assignment.title || "Assignment"}</b>
                          <div className="teacher-assignment-meta">
                            <span>
                              <small>COURSE</small>
                              <strong>
                                {assignment.course_name || "Course"}
                              </strong>
                            </span>
                            <span>
                              <small>DUE DATE</small>
                              <strong>
                                {formatDate(
                                  assignment.due_date ?? assignment.dueDate
                                )}
                              </strong>
                            </span>
                          </div>
                          {isAssignmentOpen && (
                            <div
                              className="teacher-assignment-questions"
                              id={questionsId}
                            >
                              <strong>Questions / Instructions</strong>
                              <p>
                                {assignment.description ||
                                  "No questions or instructions were provided."}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="teacher-assignment-actions">
                          <button
                            type="button"
                            className="text-button"
                            aria-expanded={isAssignmentOpen}
                            aria-controls={questionsId}
                            onClick={() =>
                              setOpenAssignmentId(
                                isAssignmentOpen ? null : assignmentId
                              )
                            }
                          >
                            {isAssignmentOpen ? "Close" : "Open"}
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => navigate("Student Submissions")}
                          >
                            View Submissions
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </>
              ) : role === "STUDENT" ? (
                <>
                  <div className="deadline-grid" style={{ marginBottom: "20px" }}>
                    <DeadlineCard
                      icon={AlertTriangle}
                      label="Overdue"
                      count={deadlineCounts.overdue}
                      type="overdue"
                    />
                    <DeadlineCard
                      icon={Clock}
                      label="Due soon"
                      count={deadlineCounts.dueSoon}
                      type="soon"
                    />
                    <DeadlineCard
                      icon={CheckCircle2}
                      label="Completed"
                      count={completedCount}
                      type="completed"
                    />
                  </div>

                  <div className="assignment-filters">
                    {[
                      ["ALL", "All"],
                      ["PENDING", "Unfinished"],
                      ["COMPLETED", "Completed"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className="text-button"
                        onClick={() => setAssignmentFilter(value)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid #dbe3f0",
                          background:
                            assignmentFilter === value ? "#5278f5" : "#fff",
                          color:
                            assignmentFilter === value ? "#fff" : "#334155",
                        }}
                      >
                        {label} (
                        {value === "ALL"
                          ? visibleAssignments.length
                          : value === "PENDING"
                            ? pendingCount
                            : completedCount}
                        )
                      </button>
                    ))}
                  </div>

                  {filteredAssignments.length === 0 ? (
                    <div className="empty-state">
                      <ClipboardList size={30} />
                      <p>
                        {visibleAssignments.length === 0
                          ? "No assignments found for your enrolled courses."
                          : `No ${assignmentFilter.toLowerCase()} assignments found.`}
                      </p>
                      {enrolledCourses.length === 0 && (
                        <small>Enroll in a course to see its assignments.</small>
                      )}
                    </div>
                  ) : (
                    filteredAssignments.map((assignment) => {
                      const assignmentId = getAssignmentId(assignment);
                      const assignmentCourseId =
                        assignment.course_id ?? assignment.courseId;
                      const assignmentCourse = courses.find(
                        (course) =>
                          String(getCourseId(course)) ===
                          String(assignmentCourseId)
                      );
                      const submission =
                        getSubmissionForAssignment(assignmentId);

                      return (
                        <StudentAssignmentRow
                          key={assignmentId}
                          assignment={assignment}
                          courseCode={
                            assignment.course_code ??
                            assignment.courseCode ??
                            assignmentCourse?.code ??
                            assignmentCourse?.course_code
                          }
                          submission={submission}
                          submissionText={
                            studentSubmissionDrafts[String(assignmentId)] ?? ""
                          }
                          submitting={
                            String(submittingAssignmentId) ===
                            String(assignmentId)
                          }
                          onSubmissionTextChange={(value) =>
                            setStudentSubmissionDrafts((previous) => ({
                              ...previous,
                              [String(assignmentId)]: value,
                            }))
                          }
                          onSubmit={() => submitAssignment(assignment)}
                          formatDate={formatDate}
                        />
                      );
                    })
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <ClipboardList size={30} />
                  <p>Assignments are not available for this role.</p>
                </div>
              )}
            </div>
          )}

          {active === "Student Submissions" && (
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {isTeacher ? "Student Submissions" : "My Submissions"}
                  </h2>
                  <p>
                    {isTeacher
                      ? "Submissions saved by students in your courses"
                      : "Your saved assignment submissions"}
                  </p>
                </div>

                <button
                  type="button"
                  className="text-button"
                  disabled={loading || savingSubmissionId != null}
                  onClick={loadSubmissionsForCurrentRole}
                >
                  {loading ? "Refreshing..." : "Refresh"}{" "}
                  <ArrowUpRight size={15} />
                </button>
              </div>

              {(isTeacher
                ? visibleTeacherSubmissions.length
                : studentSubmissions.length) === 0 ? (
                <div className="empty-state">
                  <FileCheck size={30} />
                  <p>
                    {isTeacher
                      ? studentSubmissions.length > 0
                        ? "No submissions to grade right now. New student work will appear here."
                        : "No submissions yet. Student work will appear here once it has been submitted."
                      : "You have not submitted any assignments yet."}
                  </p>
                </div>
              ) : (
                (isTeacher ? visibleTeacherSubmissions : studentSubmissions).map((submission, index) => {
                  const submissionId =
                    submission.id ??
                    submission.submission_id ??
                    submission.submissionId ??
                    `${submission.assignment_id ?? submission.assignmentId ?? "submission"}-${index}`;
                  const draftKey = String(submissionId);
                  const gradingDraft = gradingDrafts[draftKey] || {};
                  const isEditingGrade = Boolean(editingGradeIds[draftKey]);
                  const responseIsOpen =
                    Boolean(openSubmissionResponses[draftKey]);

                  const assignmentTitle =
                    submission.assignment_title ||
                    submission.assignmentTitle ||
                    `Assignment #${
                      submission.assignment_id ??
                      submission.assignmentId ??
                      ""
                    }`;

                  const submittedText =
                    submission.submission_text ||
                    submission.submissionText ||
                    submission.file_name ||
                    submission.fileName ||
                    "Submission saved";

                  const submittedAt =
                    submission.submitted_at || submission.submittedAt;
                  const relatedAssignment = assignments.find(
                    (assignment) =>
                      String(getAssignmentId(assignment)) ===
                      String(
                        submission.assignment_id ??
                          submission.assignmentId
                      )
                  );
                  const dueAt =
                    relatedAssignment?.due_date ?? relatedAssignment?.dueDate;
                  const submittedTimestamp = submittedAt
                    ? new Date(submittedAt).getTime()
                    : Number.NaN;
                  const dueTimestamp = dueAt
                    ? new Date(dueAt).getTime()
                    : Number.NaN;
                  const submissionTiming =
                    Number.isFinite(submittedTimestamp) &&
                    Number.isFinite(dueTimestamp)
                      ? submittedTimestamp <= dueTimestamp
                        ? "on-time"
                        : "late"
                      : "";

                  const studentName =
                    submission.student_name ||
                    submission.studentName ||
                    submission.student_email ||
                    submission.studentEmail;

                  const grade = submission.grade;
                  const hasGrade =
                    grade !== null &&
                    grade !== undefined &&
                    String(grade).trim() !== "";
                  return (
                    <div
                      className={`assignment-row ${
                        isTeacher
                          ? "teacher-submission-row"
                          : "student-submission-card"
                      }`}
                      key={submissionId}
                    >
                      <div className="assignment-symbol">
                        <CheckCircle2 size={19} />
                      </div>

                      <div className="assignment-info">
                        {isTeacher && (
                          <>
                          <div className="teacher-submission-course-title">
                            {submission.course_name ||
                              submission.courseName ||
                              "Course"}
                          </div>
                          <div className="teacher-submission-meta">
                            <span>
                              <small>STUDENT NAME</small>
                              <strong>{studentName || "Student"}</strong>
                            </span>
                            <span>
                              <small>ASSIGNMENT</small>
                              <strong>{assignmentTitle}</strong>
                            </span>
                            <span
                              className={
                                submissionTiming
                                  ? `submission-timing-${submissionTiming}`
                                  : undefined
                              }
                            >
                              <small>SUBMITTED ON</small>
                              <strong>
                                {submittedAt
                                  ? formatDate(submittedAt)
                                  : "Date not provided"}
                              </strong>
                            </span>
                          </div>
                          </>
                        )}

                        {isTeacher && (
                          <div className="teacher-response">
                            <button
                              type="button"
                              className="text-button teacher-response-toggle"
                              aria-expanded={responseIsOpen}
                              aria-controls={`submission-response-${draftKey}`}
                              onClick={() =>
                                setOpenSubmissionResponses((previous) => ({
                                  ...previous,
                                  [draftKey]: !previous[draftKey],
                                }))
                              }
                            >
                              {responseIsOpen ? "Hide Response" : "View Response"}
                              <ArrowUpRight size={14} />
                            </button>
                            {responseIsOpen && (
                              <div
                                className="teacher-response-content"
                                id={`submission-response-${draftKey}`}
                              >
                                <strong>Student Response</strong>
                                <p>{submittedText}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {!isTeacher && (
                          <>
                            <div className="student-submission-course-heading">
                              {submission.course_name ||
                                submission.courseName ||
                                "Course"}
                            </div>
                            <div className="student-submission-meta">
                              <span className="submission-assignment-box">
                                <small>ASSIGNMENT</small>
                                <strong>{assignmentTitle}</strong>
                              </span>
                              <span>
                                <small>SUBMITTED</small>
                                <strong>
                                  {submittedAt
                                    ? formatDate(submittedAt)
                                    : "Date not provided"}
                                </strong>
                              </span>
                              {hasGrade ? (
                                <div className="student-submission-result">
                                  <small>RESULT</small>
                                  <strong>{grade} / 100 marks</strong>
                                  <span className={`grade-colorful ${getGradeColorClass(grade)}`}>
                                    {getLetterGrade(grade) || "—"}
                                  </span>
                                </div>
                              ) : (
                                <div className="student-submission-result pending">
                                  <small>RESULT</small>
                                  <strong>Awaiting grade</strong>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {isTeacher && hasGrade && !isEditingGrade && (
                          <div className="teacher-saved-grade teacher-response-result">
                            <span
                              className={`teacher-saved-grade-letter grade-colorful ${getGradeColorClass(grade)}`}
                            >
                              {getLetterGrade(grade) || "—"}
                            </span>
                            <span>
                              <small>Result</small>
                              <strong>
                                {grade} <span>/ 100 marks</span>
                              </strong>
                            </span>
                          </div>
                        )}

                        {isTeacher && hasGrade && !isEditingGrade && (
                          <button
                            type="button"
                            className="text-button edit-grade-button"
                            onClick={() => {
                              setGradingDrafts((previous) => ({
                                ...previous,
                                [draftKey]: {
                                  ...previous[draftKey],
                                  grade: String(grade),
                                },
                              }));
                              setEditingGradeIds((previous) => ({
                                ...previous,
                                [draftKey]: true,
                              }));
                            }}
                          >
                            Edit Marks
                          </button>
                        )}

                        {isTeacher && (!hasGrade || isEditingGrade) && (
                          <div className="submission-grading">
                            <label>
                              Marks
                              <input
                                className="grading-input"
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={gradingDraft.grade ?? grade ?? ""}
                                onChange={(event) =>
                                  updateGradingDraft(
                                    submissionId,
                                    "grade",
                                    event.target.value
                                  )
                                }
                              />
                            </label>

                            <button
                              type="button"
                              className="primary-button"
                              disabled={savingSubmissionId != null}
                              onClick={() =>
                                saveSubmissionGrade(
                                  submission.id ??
                                    submission.submission_id ??
                                    submission.submissionId
                                )
                              }
                            >
                              {String(savingSubmissionId) ===
                              String(submissionId)
                                ? "Saving..."
                                : hasGrade
                                  ? "Update Marks"
                                  : "Save Marks"}
                            </button>
                            {isEditingGrade && (
                              <button
                                type="button"
                                className="text-button"
                                disabled={savingSubmissionId != null}
                                onClick={() => {
                                  setEditingGradeIds((previous) => ({
                                    ...previous,
                                    [draftKey]: false,
                                  }));
                                  setGradingDrafts((previous) => {
                                    const next = { ...previous };
                                    delete next[draftKey];
                                    return next;
                                  });
                                }}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <span
                        className={`status-badge grading-status ${
                          !isTeacher
                            ? hasGrade
                              ? "student-submission-graded"
                              : "student-submission-pending"
                            : ""
                        }`}
                      >
                        {hasGrade ? "Graded" : "Pending Grading"}
                      </span>
                    </div>
                  );
                })
              )}

            </div>
          )}

          {active === "Grades & Performance" && role === "STUDENT" && (
            <>
              <div className="stats-grid grades-stats-grid">
                <Stat
                  icon={ChartNoAxesColumn}
                  label="Overall Average"
                  value={
                    gradeAverage === null ? "—" : `${gradeAverage.toFixed(1)}%`
                  }
                  color="blue"
                  detail="Average of graded assignments"
                />

                <Stat
                  icon={CheckCircle2}
                  label="Graded Assignments"
                  value={gradedResults.length}
                  color="green"
                  detail="Assignments with saved grades"
                />

                <Stat
                  icon={Clock}
                  label="Pending Grades"
                  value={pendingGradeCount}
                  color="orange"
                  detail="Assignments awaiting a grade"
                />
              </div>

              <div className="panel grades-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Assignment Results</h2>
                    <p>Your saved assignment grades</p>
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    disabled={studentSubmissionsLoading}
                    onClick={() => loadStudentSubmissions(authUser?.id)}
                  >
                    {studentSubmissionsLoading ? "Refreshing..." : "Refresh"}{" "}
                    <ArrowUpRight size={15} />
                  </button>
                </div>

                {studentSubmissionsLoading && gradeResults.length === 0 ? (
                  <div className="empty-state">
                    <p>Loading your grades...</p>
                  </div>
                ) : gradeResults.length === 0 ? (
                  <div className="empty-state">
                    <ChartNoAxesColumn size={30} />
                    <p>No assignment results are available yet.</p>
                  </div>
                ) : (
                  <div className="grades-table-wrap">
                    <table className="grades-table">
                      <thead>
                        <tr>
                          <th scope="col">Assignment</th>
                          <th scope="col">Course</th>
                          <th scope="col">Grade</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradeResults.map((result, index) => (
                          <tr key={`${result.assignment}-${index}`}>
                            <td>{result.assignment}</td>
                            <td>{result.course}</td>
                            <td>
                              {result.grade === null ? (
                                "—"
                              ) : (
                                <span className={`grade-colorful ${getGradeColorClass(result.grade)}`}>
                                  {result.grade}% · {result.letterGrade}
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="status-badge grading-status">
                                {result.grade === null
                                  ? "Pending Grading"
                                  : "Graded"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {active === "Fee Payments" && role === "STUDENT" && (
            <div className="panel fee-payments-panel">
              <div className="panel-heading">
                <div>
                  <h2>Fee Payment Records</h2>
                  <p>Payment transactions currently associated with your account</p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  disabled={paymentsLoading}
                  onClick={() => loadStudentPayments(authUser?.id)}
                >
                  {paymentsLoading ? "Refreshing..." : "Refresh"}{" "}
                  <ArrowUpRight size={15} />
                </button>
              </div>

              <div className="fee-summary-grid">
                <div className="fee-summary-item">
                  <span>Recorded paid transactions</span>
                  <strong>₹{paidPaymentTotal.toFixed(2)}</strong>
                </div>
                <div className="fee-summary-item">
                  <span>Pending transactions</span>
                  <strong>₹{pendingPaymentTotal.toFixed(2)}</strong>
                </div>
                <div className="fee-summary-item fee-demo-summary-item">
                  <span>Demo records (not payable)</span>
                  <strong>₹{demoPaymentTotal.toFixed(2)}</strong>
                </div>
              </div>

              <form
                className="fee-payment-form"
                onSubmit={createDemoPayment}
              >
                <label>
                  Payment description
                  <input
                    type="text"
                    maxLength="255"
                    placeholder="e.g. Semester tuition"
                    value={paymentDraft.description}
                    onChange={(event) =>
                      setPaymentDraft((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Amount (₹)
                  <input
                    type="number"
                    min="0.01"
                    max="999999999"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentDraft.amount}
                    onChange={(event) =>
                      setPaymentDraft((previous) => ({
                        ...previous,
                        amount: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingPayment}
                >
                  {savingPayment ? "Creating demo..." : "Create demo payment"}
                </button>
              </form>

              {paymentsLoading && payments.length === 0 ? (
                <div className="empty-state fee-payment-empty">
                  <p>Loading payment records...</p>
                </div>
              ) : payments.length === 0 ? (
                <div className="empty-state fee-payment-empty">
                  <CreditCard size={28} />
                  <p>No payment records are available.</p>
                </div>
              ) : (
                <div className="grades-table-wrap">
                  <table className="grades-table">
                    <thead>
                      <tr>
                        <th scope="col">Description</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Status</th>
                        <th scope="col">Recorded</th>
                        <th scope="col">Paid at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>
                            {String(payment.description || "").startsWith("DEMO: ")
                              ? payment.description.slice(6)
                              : payment.description || "Payment record"}
                          </td>
                          <td>₹{Number(payment.amount || 0).toFixed(2)}</td>
                          <td>
                            <span className="status-badge grading-status">
                              {isDemoPayment(payment)
                                ? "DEMO"
                                : payment.status || "Unknown"}
                            </span>
                          </td>
                          <td>{formatDate(payment.created_at)}</td>
                          <td>{payment.paid_at ? formatDate(payment.paid_at) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {active === "Attendance" && role === "STUDENT" && (
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>My Attendance</h2>
                  <p>Attendance records recorded for your enrolled courses</p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  disabled={attendanceLoading}
                  onClick={() => loadStudentAttendance(authUser?.id)}
                >
                  {attendanceLoading ? "Refreshing..." : "Refresh"}{" "}
                  <ArrowUpRight size={15} />
                </button>
              </div>
              {attendanceLoading && attendanceRecords.length === 0 ? (
                <div className="empty-state"><p>Loading attendance...</p></div>
              ) : attendanceRecords.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 size={28} />
                  <p>No attendance records have been recorded yet.</p>
                </div>
              ) : (
                <>
                  {myCourses.map((course) => {
                    const courseId = getCourseId(course);
                    const courseRecords = attendanceRecords.filter(
                      (record) => String(record.course_id) === String(courseId)
                    );
                    if (courseRecords.length === 0) return null;
                    const attended = courseRecords.filter((record) =>
                      ["PRESENT", "LATE"].includes(
                        String(record.status).toUpperCase()
                      )
                    ).length;
                    const percentage = (attended / courseRecords.length) * 100;
                    return (
                      <div className="attendance-course" key={courseId}>
                        <div className="attendance-course-heading">
                          <strong>{course.name || course.title || `Course ${courseId}`}</strong>
                          <span>{attended}/{courseRecords.length} classes · {percentage.toFixed(1)}%</span>
                        </div>
                        <div className="attendance-list">
                          {courseRecords.map((record) => (
                            <div className="attendance-record" key={record.id}>
                              <span>{formatDate(record.attendance_date)}</span>
                              <span className="status-badge grading-status">{record.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {active === "Timetable" && (
            <div className="panel timetable-panel">
              <div className="panel-heading timetable-heading">
                <div>
                  <h2>Weekly Timetable</h2>
                  <p>
                    {isTeacher
                      ? "Manage recurring class times for your assigned courses"
                      : "Your weekly classes for enrolled courses"}
                  </p>
                </div>
                <div className="timetable-heading-actions">
                  <span className="timetable-entry-count">
                    {timetableEntries.length} {timetableEntries.length === 1 ? "class" : "classes"}
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    disabled={timetableLoading}
                    onClick={loadTimetable}
                  >
                    {timetableLoading ? "Refreshing..." : "Refresh"}
                    <ArrowUpRight size={15} />
                  </button>
                  {isTeacher && teacherCourses.length > 0 && (
                    <button
                      type="button"
                      className="primary-button timetable-add-button"
                      onClick={() => {
                        resetTimetableForm();
                        setShowTimetableForm(true);
                      }}
                    >
                      <Plus size={15} />
                      Add class
                    </button>
                  )}
                </div>
              </div>

              {isTeacher && showTimetableForm && (
                <form className="timetable-form" onSubmit={saveTimetableEntry}>
                  <div className="timetable-form-heading">
                    <div>
                      <strong>{editingTimetableId == null ? "Add a class" : "Edit class"}</strong>
                      <span>Set a weekly course day, time, and classroom.</span>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={resetTimetableForm}
                      aria-label="Close timetable form"
                    >
                      <X size={17} />
                    </button>
                  </div>
                  <div className="timetable-form-grid">
                    <label>
                      Course
                      <select
                        value={timetableDraft.courseId}
                        onChange={(event) =>
                          setTimetableDraft((previous) => ({
                            ...previous,
                            courseId: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="">Select assigned course</option>
                        {teacherCourses.map((course) => (
                          <option key={getCourseId(course)} value={getCourseId(course)}>
                            {course.code ? `${course.code} · ` : ""}
                            {course.name || course.title || `Course ${getCourseId(course)}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Day
                      <select
                        value={timetableDraft.dayOfWeek}
                        onChange={(event) =>
                          setTimetableDraft((previous) => ({
                            ...previous,
                            dayOfWeek: event.target.value,
                          }))
                        }
                        required
                      >
                        {TIMETABLE_DAYS.map((day) => (
                          <option value={day} key={day}>
                            {day.charAt(0) + day.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Start time
                      <input
                        type="time"
                        value={timetableDraft.startTime}
                        onChange={(event) =>
                          setTimetableDraft((previous) => ({
                            ...previous,
                            startTime: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      End time
                      <input
                        type="time"
                        value={timetableDraft.endTime}
                        onChange={(event) =>
                          setTimetableDraft((previous) => ({
                            ...previous,
                            endTime: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Classroom
                      <input
                        type="text"
                        maxLength="120"
                        placeholder="e.g. Block A · Room 204"
                        value={timetableDraft.classroom}
                        onChange={(event) =>
                          setTimetableDraft((previous) => ({
                            ...previous,
                            classroom: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="timetable-form-actions">
                    <button
                      type="button"
                      className="text-button"
                      disabled={savingTimetableEntry}
                      onClick={resetTimetableForm}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={savingTimetableEntry}
                    >
                      {savingTimetableEntry
                        ? "Saving..."
                        : editingTimetableId == null
                          ? "Save class"
                          : "Update class"}
                    </button>
                  </div>
                </form>
              )}

              {timetableLoading && timetableEntries.length === 0 ? (
                <div className="empty-state timetable-empty">
                  <p>Loading your timetable...</p>
                </div>
              ) : timetableEntries.length === 0 ? (
                <div className="notification-empty timetable-empty">
                  <span className="notification-empty-icon">
                    <CalendarDays size={22} />
                  </span>
                  <strong>
                    {isTeacher ? "Your timetable is ready to build" : "No classes scheduled yet"}
                  </strong>
                  <p>
                    {isTeacher
                      ? teacherCourses.length > 0
                        ? "Add your first class to publish its weekly day, time, and classroom."
                        : "Create or assign a course before adding timetable classes."
                      : "Your enrolled-course class times will appear here once they are scheduled."}
                  </p>
                </div>
              ) : (
                <div className="timetable-table-wrap">
                  <table className="timetable-table">
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        <th scope="col">Course</th>
                        <th scope="col">Time</th>
                        <th scope="col">Instructor</th>
                        <th scope="col">Room</th>
                        {isTeacher && <th scope="col">Actions</th>}
                      </tr>
                    </thead>
                    {TIMETABLE_DAYS.map((day) => {
                      const dayEntries = timetableEntries
                        .filter(
                          (entry) =>
                            String(entry.day_of_week || "").toUpperCase() === day
                        )
                        .sort((first, second) =>
                          String(first.start_time).localeCompare(
                            String(second.start_time)
                          )
                        );
                      return (
                        <tbody key={day}>
                          {dayEntries.length === 0 ? (
                            <tr className="timetable-no-classes">
                              <th scope="row">
                                {day.charAt(0) + day.slice(1).toLowerCase()}
                              </th>
                              <td colSpan={isTeacher ? 5 : 4}>
                                No classes scheduled
                              </td>
                            </tr>
                          ) : (
                            dayEntries.map((entry, entryIndex) => (
                              <tr key={entry.id}>
                                {entryIndex === 0 && (
                                  <th
                                    className="timetable-day-cell"
                                    scope="rowgroup"
                                    rowSpan={dayEntries.length}
                                  >
                                    {day.charAt(0) + day.slice(1).toLowerCase()}
                                    <span>
                                      {dayEntries.length}{" "}
                                      {dayEntries.length === 1 ? "class" : "classes"}
                                    </span>
                                  </th>
                                )}
                                <td>
                                  <strong className="timetable-course-name">
                                    {entry.course_name || "Course"}
                                  </strong>
                                  <span className="timetable-course-code">
                                    {entry.course_code || "Scheduled class"}
                                  </span>
                                </td>
                                <td className="timetable-time-cell">
                                  <Clock size={14} />
                                  <span>
                                    {formatTimetableTime(entry.start_time)} –{" "}
                                    {formatTimetableTime(entry.end_time)}
                                  </span>
                                </td>
                                <td>{entry.instructor || "—"}</td>
                                <td>
                                  {entry.classroom ? (
                                    <span className="timetable-room-cell">
                                      <MapPin size={14} />
                                      {entry.classroom}
                                    </span>
                                  ) : "—"}
                                </td>
                                {isTeacher && (
                                  <td>
                                    <div className="timetable-class-actions">
                                      <button
                                        type="button"
                                        className="timetable-icon-action"
                                        onClick={() => editTimetableEntry(entry)}
                                        aria-label={`Edit ${entry.course_name || "class"}`}
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        className="timetable-icon-action delete"
                                        onClick={() => deleteTimetableEntry(entry)}
                                        aria-label={`Remove ${entry.course_name || "class"}`}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      );
                    })}
                  </table>
                </div>
              )}
            </div>
          )}

          {active === "Attendance Management" && isTeacher && (
            <div className="panel attendance-management-panel">
              <div className="panel-heading">
                <div>
                  <h2>Attendance Management</h2>
                  <p>Record attendance only for courses assigned to you</p>
                </div>
              </div>
              <form className="attendance-form" onSubmit={saveAttendance}>
                <label>
                  Course
                  <select
                    value={attendanceCourseId}
                    onChange={(event) => {
                      const courseId = event.target.value;
                      setAttendanceCourseId(courseId);
                      loadTeacherCourseStudents(courseId);
                    }}
                    required
                  >
                    <option value="">Select a course</option>
                    {teacherCourses.map((course) => (
                      <option key={getCourseId(course)} value={getCourseId(course)}>
                        {course.name || course.title || `Course ${getCourseId(course)}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Attendance date
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(event) => {
                      setAttendanceDate(event.target.value);
                      setAttendanceStatuses({});
                    }}
                    required
                  />
                </label>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    savingAttendance ||
                    attendanceLoading ||
                    courseStudents.length === 0 ||
                    attendanceDateHasRecords
                  }
                >
                  {savingAttendance
                    ? "Saving..."
                    : attendanceDateHasRecords
                      ? "Attendance Saved"
                      : "Save Attendance"}
                </button>
              </form>

              {attendanceDateHasRecords && (
                <p className="attendance-edit-note">
                  Attendance is saved for this course and date and can no longer be changed.
                </p>
              )}

              {attendanceLoading ? (
                <div className="attendance-empty-state">
                  <span className="attendance-empty-icon"><Clock size={20} /></span>
                  <strong>Loading course roster</strong>
                  <p>Fetching the enrolled students for this course.</p>
                </div>
              ) : !attendanceCourseId ? (
                null
              ) : courseStudents.length === 0 ? (
                <div className="attendance-empty-state">
                  <span className="attendance-empty-icon"><Users size={20} /></span>
                  <strong>No students enrolled yet</strong>
                  <p>Students enrolled in this course will appear here.</p>
                </div>
              ) : (
                <div className="attendance-students">
                  {courseStudents.map((student) => {
                    const existingRecord = attendanceRecords.find(
                      (record) =>
                        String(record.student_id) === String(student.id) &&
                        String(record.attendance_date).slice(0, 10) === attendanceDate
                    );
                    const selectedStatus =
                      attendanceStatuses[String(student.id)] ||
                      existingRecord?.status ||
                      "";
                    return (
                      <label className="attendance-student-row" key={student.id}>
                        <span>
                          <strong>{student.name || student.email}</strong>
                          <small>{student.email}</small>
                        </span>
                        <select
                          value={selectedStatus}
                          disabled={attendanceDateHasRecords}
                          onChange={(event) =>
                            setAttendanceStatuses((previous) => ({
                              ...previous,
                              [String(student.id)]: event.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Choose status</option>
                          {["PRESENT", "ABSENT", "LATE", "EXCUSED"].map((status) => (
                            <option value={status} key={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(active === "Grades" || active === "Student Performance") &&
            isTeacher && (
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>{active}</h2>
                    <p>
                      {active === "Grades"
                        ? "Review saved grades for your courses"
                        : "Performance results based only on actual submissions and grades"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-button"
                    disabled={loading}
                    onClick={loadSubmissionsForCurrentRole}
                  >
                    {loading ? "Refreshing..." : "Refresh"} <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="grades-table-wrap">
                  {studentSubmissions.length === 0 ? (
                    <div className="empty-state">
                      <ChartNoAxesColumn size={28} />
                      <p>No student submissions are available for your courses.</p>
                    </div>
                  ) : (
                    <table className="grades-table">
                      <thead>
                        <tr>
                          <th scope="col">Student</th>
                          <th scope="col">Assignment</th>
                          <th scope="col">Course</th>
                          <th scope="col">Grade</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentSubmissions.map((submission, index) => {
                          const hasGrade =
                            submission.grade != null &&
                            String(submission.grade).trim() !== "";
                          return (
                            <tr key={submission.id ?? submission.submission_id ?? index}>
                              <td>{submission.student_name || submission.student_email || "Student"}</td>
                              <td>{submission.assignment_title || submission.assignmentTitle || "Assignment"}</td>
                              <td>{submission.course_name || submission.courseName || "—"}</td>
                              <td>
                                {hasGrade ? (
                                  <span className={`grade-colorful ${getGradeColorClass(submission.grade)}`}>
                                    {submission.grade}% · {getLetterGrade(submission.grade) || "—"}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td>
                                <span className="status-badge grading-status">
                                  {hasGrade ? "Graded" : "Pending Grading"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                {active === "Student Performance" && gradeResults.some((result) => result.grade !== null) && (
                  <div className="performance-bars">
                    {gradeResults.filter((result) => result.grade !== null).map((result, index) => (
                      <div className="performance-bar-row" key={`${result.assignment}-${index}`}>
                        <span>{result.assignment}</span>
                        <div className="performance-bar-track">
                          <div className="performance-bar-value" style={{ width: `${result.grade}%` }} />
                        </div>
                        <strong>
                          <span className={`grade-colorful ${getGradeColorClass(result.grade)}`}>
                            {result.grade}% · {result.letterGrade}
                          </span>
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          {(active === "Notifications" || active === "AI Study Assistant") &&
            role === "STUDENT" && (
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>{active}</h2>
                    {active === "Notifications" && (
                      <p>Your latest academic updates, deadlines, and reminders</p>
                    )}
                  </div>
                  {active === "Notifications" && visibleStudentNotifications.length > 0 && (
                    <span className="notification-summary">
                      {visibleStudentNotifications.length} new
                    </span>
                  )}
                </div>
                {active === "AI Study Assistant" ? (
                  recommendedAssignment ? (
                    <div className="notification-item">
                      <p>
                        <strong>Course Code:</strong> {recommendedCourseCode}
                      </p>
                      <p>
                        <strong>Assignment Title:</strong>{" "}
                        {recommendedAssignment.title || "Assignment"}
                      </p>
                      <p>
                        <strong>Due Date and Time:</strong>{" "}
                        {formatDate(
                          recommendedAssignment.due_date ??
                            recommendedAssignment.dueDate
                        )}
                      </p>
                    </div>
                  ) : null
                ) : visibleStudentNotifications.length === 0 ? (
                  <div className="notification-empty">
                    <span className="notification-empty-icon"><CheckCircle2 size={22} /></span>
                    <strong>You’re all caught up</strong>
                    <p>New grades, deadlines, and payment reminders will appear here.</p>
                  </div>
                ) : visibleStudentNotifications.map((item) => (
                  <article
                    className={`notification-card notification-${item.type}`}
                    key={item.id}
                  >
                    <span className="notification-card-icon">
                      {item.type === "deadline" ? (
                        <Clock size={18} />
                      ) : item.type === "grade" ? (
                        <ChartNoAxesColumn size={18} />
                      ) : (
                        <CreditCard size={18} />
                      )}
                    </span>
                    <div className="notification-card-content">
                      <span className="notification-category">
                        {item.type === "deadline"
                          ? "Assignment deadline"
                          : item.type === "grade"
                            ? "Grade update"
                            : "Payment reminder"}
                      </span>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <button
                      type="button"
                      className="notification-dismiss"
                      onClick={() => markNotificationAsSeen(item.id)}
                      aria-label={`Mark as seen: ${item.title}`}
                    >
                      <CheckCircle2 size={15} />
                      <span>Mark as seen</span>
                    </button>
                  </article>
                ))}
              </div>
            )}

          {active === "My Profile" && (
            <div className="profile-page">
              <section className="profile-hero">
                <div className="profile-avatar">{avatarLetter}</div>
                <div className="profile-hero-copy">
                  <span className="profile-eyebrow">ACADEMIAX ACCOUNT</span>
                  <h2>{displayName}</h2>
                  <p>
                    {role === "STUDENT"
                      ? "Your student profile and academic details"
                      : isTeacher
                        ? "Your instructor profile and workspace details"
                        : "Your administrator profile and workspace details"}
                  </p>
                </div>
                <span className={`profile-role-badge ${role.toLowerCase()}`}>
                  {role === "STUDENT" ? <GraduationCap size={15} /> : <BookOpen size={15} />}
                  {profileRoleLabel}
                </span>
              </section>

              <div className="profile-card-grid">
                <section className="panel profile-info-card">
                  <div className="profile-section-heading">
                    <span className="profile-section-icon personal"><UserRound size={18} /></span>
                    <div>
                      <h3>Personal Information</h3>
                      <p>Your account details</p>
                    </div>
                  </div>
                  <div className="profile-details-grid">
                    {profileDetails
                      .filter((detail) =>
                        ["Full name", "Email address", "Account ID"].includes(detail.label)
                      )
                      .map((detail) => (
                        <div className="profile-detail" key={detail.label}>
                          <span>{detail.label}</span>
                          <strong>{detail.value}</strong>
                        </div>
                      ))}
                  </div>
                </section>

                <section className="panel profile-info-card">
                  <div className="profile-section-heading">
                    <span className="profile-section-icon academic"><BookOpen size={18} /></span>
                    <div>
                      <h3>Academic Details</h3>
                      <p>Your role and learning workspace</p>
                    </div>
                  </div>
                  <div className="profile-details-grid">
                    {profileDetails
                      .filter((detail) =>
                        ["Account type", "Department / Branch", "Year of study", "Semester"].includes(detail.label)
                      )
                      .map((detail) => (
                        <div className="profile-detail" key={detail.label}>
                          <span>{detail.label}</span>
                          <strong>{detail.value}</strong>
                        </div>
                      ))}
                    <div className="profile-detail">
                      <span>
                        {role === "STUDENT"
                          ? "Enrolled courses"
                          : isTeacher
                            ? "Assigned courses"
                            : "Courses in workspace"}
                      </span>
                      <strong>
                        {role === "STUDENT"
                          ? enrolledCourses.length
                          : isTeacher
                            ? teacherCourses.length
                            : courses.length}
                      </strong>
                    </div>
                  </div>
                  <p className="profile-readonly-note">
                    Profile details are shown from your AcademiaX account.
                  </p>
                </section>
              </div>
            </div>
          )}

          {active === "Notifications" && isTeacher && (
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Notifications</h2>
                  <p>Submissions from your courses that are waiting for review</p>
                </div>
                {visibleTeacherNotifications.length > 0 && (
                  <span className="notification-summary">
                    {visibleTeacherNotifications.length} to review
                  </span>
                )}
              </div>
              {visibleTeacherNotifications.length === 0 ? (
                <div className="notification-empty">
                  <span className="notification-empty-icon"><CheckCircle2 size={22} /></span>
                  <strong>You’re all caught up</strong>
                  <p>New student submissions that need grading will appear here.</p>
                </div>
              ) : (
                visibleTeacherNotifications.map((item) => (
                  <article
                    className="notification-card notification-grading"
                    key={item.id}
                  >
                    <span className="notification-card-icon">
                      <FileCheck size={18} />
                    </span>
                    <div className="notification-card-content">
                      <span className="notification-category">Grading task</span>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <div className="notification-card-actions">
                      <button
                        type="button"
                        className="notification-open"
                        onClick={() => {
                          markNotificationAsSeen(item.id);
                          navigate("Student Submissions");
                        }}
                      >
                        Review
                        <ArrowUpRight size={14} />
                      </button>
                      <button
                        type="button"
                        className="notification-dismiss"
                        onClick={() => markNotificationAsSeen(item.id)}
                        aria-label={`Mark as seen: ${item.title}`}
                      >
                        <CheckCircle2 size={15} />
                        <span>Seen</span>
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}

          {active !== "Dashboard" &&
            active !== "Course Catalog" &&
            active !== "Manage Courses" &&
            active !== "My Courses" &&
            active !== "Enrollment" &&
            active !== "Assignments" &&
            active !== "Student Submissions" &&
            active !== "Grades & Performance" &&
            active !== "Fee Payments" &&
            active !== "Attendance" &&
            active !== "Timetable" &&
            active !== "Attendance Management" &&
            active !== "Grades" &&
            active !== "Student Performance" &&
            active !== "My Profile" &&
            active !== "Notifications" &&
            active !== "AI Study Assistant" && (
              <div className="panel placeholder-panel">
                <div className="placeholder-icon">
                  <GraduationCap size={30} />
                </div>

                <h2>{active}</h2>

                <p>
                  This page is included in the navigation. Its database
                  operations and forms still need to be implemented.
                </p>

                <button
                  className="primary-button"
                  onClick={() => navigate("Dashboard")}
                >
                  Back to Dashboard
                </button>
              </div>
            )}
        </section>
      </main>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
  detail = "AcademiaX workspace",
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon size={21} />
      </div>

      <div className="stat-content">
        <p>{label}</p>
        <h2>{value}</h2>
        <small>
          <span className="stat-dot" />
          {detail}
        </small>
      </div>
    </div>
  );
}

function Quick({ icon: Icon, title, text, onClick }) {
  return (
    <button className="quick-item" onClick={onClick}>
      <div className="quick-icon">
        <Icon size={20} />
      </div>

      <div>
        <b>{title}</b>
        <small>{text}</small>
      </div>

      <ArrowUpRight className="quick-arrow" size={16} />
    </button>
  );
}

function DeadlineCard({ icon: Icon, label, count, type }) {
  return (
    <div className={`deadline-card ${type}`}>
      <Icon size={19} />

      <div>
        <strong>{count}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function StudentAssignmentRow({
  assignment,
  courseCode,
  submission,
  submissionText,
  submitting,
  onSubmissionTextChange,
  onSubmit,
  formatDate,
}) {
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const rawGrade = submission?.grade;
  const hasGrade =
    rawGrade !== null &&
    rawGrade !== undefined &&
    String(rawGrade).trim() !== "";

  return (
    <div className="assignment-row student-assignment-row">
      <div className="assignment-symbol">
        {submission ? <CheckCircle2 size={19} /> : <ClipboardList size={19} />}
      </div>

      <div className="assignment-info">
        <b>{assignment.title || "Assignment"}</b>
        <div className="student-assignment-meta">
          <div className="student-assignment-meta-item">
            <BookOpen size={15} />
            <span>
              <small>Course</small>
              <strong>
                {courseCode ? `${courseCode} · ` : ""}
                {assignment.course_name ||
                  assignment.courseName ||
                  "Course"}
              </strong>
            </span>
          </div>
          <div className="student-assignment-meta-item">
            <CalendarDays size={15} />
            <span>
              <small>Due date and time</small>
              <strong>
                {formatDate(assignment.due_date ?? assignment.dueDate)}
              </strong>
            </span>
          </div>
          <button
            type="button"
            className="text-button student-questions-toggle"
            aria-expanded={questionsOpen}
            aria-controls={`student-assignment-questions-${getStableId(assignment)}`}
            onClick={() => setQuestionsOpen((open) => !open)}
          >
            {questionsOpen ? "Close" : "Open"} Questions / Instructions
          </button>
        </div>

        {questionsOpen && (
          <div
            className="student-assignment-questions"
            id={`student-assignment-questions-${getStableId(assignment)}`}
          >
            <strong>Questions / Instructions</strong>
            <p>
              {assignment.description || "No instructions provided."}
            </p>
          </div>
        )}

        {!submission && (
          <div className="student-submission-form">
            <label htmlFor={`submission-${getStableId(assignment)}`}>
              Your response
            </label>
            <textarea
              id={`submission-${getStableId(assignment)}`}
              className="student-submission-input"
              rows="3"
              value={submissionText}
              onPaste={(event) => event.preventDefault()}
              onDrop={(event) => event.preventDefault()}
              onChange={(event) =>
                onSubmissionTextChange(event.target.value)
              }
              placeholder="Enter your assignment response"
            />
            <small className="submission-entry-note">
              Please type your response. Pasting text is disabled.
            </small>
            <button
              type="button"
              className="primary-button"
              disabled={submitting || !submissionText.trim()}
              onClick={onSubmit}
            >
              {submitting ? "Submitting..." : "Submit Assignment"}
            </button>
          </div>
        )}

      </div>

      <span className="status-badge grading-status">
        {hasGrade
          ? "Graded"
          : submission
            ? "Submitted"
            : "Not Submitted"}
      </span>
    </div>
  );
}

function getStableId(item) {
  return item.id ?? item.assignmentId ?? item.assignment_id;
}
