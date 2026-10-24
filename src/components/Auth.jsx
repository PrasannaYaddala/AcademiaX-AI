
import { useState } from "react";
import {
  GraduationCap,
  Mail,
  Lock,
  UserRound,
  Eye,
  EyeOff,
} from "lucide-react";
import "./Auth.css";

const API = import.meta.env.VITE_API_URL || "/api";

const PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;

const PASSWORD_MESSAGE =
  "Password must contain at least 8 characters, one uppercase letter (A-Z), one number (0-9), and one special symbol (e.g. ! @ # $).";

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "STUDENT",
    branch: "CSE",
    yearOfStudy: "1",
    semester: "1",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(e) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    const registering = mode === "register";

    if (registering && !PASSWORD_PATTERN.test(form.password)) {
      setError(PASSWORD_MESSAGE);
      return;
    }

    if (loading) return;

    setLoading(true);

    const endpoint = registering
      ? "/auth/register"
      : "/auth/login";

    const body = registering
      ? {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          branch: form.branch,
          ...(form.role === "STUDENT"
            ? {
                yearOfStudy: Number(form.yearOfStudy),
                semester: Number(form.semester),
              }
            : {}),
        }
      : {
          email: form.email.trim(),
          password: form.password,
        };

    try {
      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Request failed. Please check your details."
        );
      }

      if (registering) {
        setMode("login");

        setForm((previous) => ({
          ...previous,
          password: "",
        }));

        setShowPassword(false);
        setError("Registration successful! Please sign in.");
      } else {
        if (typeof onAuthSuccess === "function") {
          onAuthSuccess(data);
        } else {
          setError(
            "Login succeeded, but the application did not provide an authentication handler."
          );
        }
      }
    } catch (err) {
      setError(
        err.message ||
          "Cannot connect to the server. Check that Spring Boot is running on port 8080."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode((previous) =>
      previous === "login" ? "register" : "login"
    );

    setError("");
    setShowPassword(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-info">
        <div className="auth-brand">
          <span className="auth-logo">
            <GraduationCap size={28} />
          </span>

          <span>
            AcademiaX
            <small>ACADEMIC PORTAL</small>
          </span>
        </div>

        <div className="auth-message">
          <span className="auth-eyebrow">
            YOUR FUTURE STARTS HERE
          </span>

          <h1>
            Learn smarter.
            <br />
            Achieve more.
          </h1>

          <p>
            One place to manage courses, assignments, academic
            progress, and communication between students and teachers.
          </p>

          <div className="auth-feature">
            <span>✓</span> Course enrollment and tracking
          </div>

          <div className="auth-feature">
            <span>✓</span> Assignment submissions and feedback
          </div>

          <div className="auth-feature">
            <span>✓</span> Academic progress in one place
          </div>
        </div>

        <small className="auth-footer">
          ACADEMIAX · UNIVERSITY LEARNING
        </small>
      </section>

      <section className="auth-form-side">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-mobile-brand">
            <GraduationCap size={28} /> AcademiaX
          </div>

          <span className="auth-eyebrow">
            {mode === "login" ? "WELCOME BACK" : "JOIN ACADEMIAX"}
          </span>

          <h2>
            {mode === "login"
              ? "Sign in to your account"
              : "Create your account"}
          </h2>

          <p className="auth-subtitle">
            {mode === "login"
              ? "Enter your details to access your academic workspace."
              : "Fill in your details to get started."}
          </p>

          {mode === "register" && (
            <>
              <label htmlFor="name">Full name</label>

              <div className="auth-input">
                <UserRound size={18} />

                <input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={update}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                />
              </div>

              <label htmlFor="role">Account type</label>

              <select
                id="role"
                name="role"
                value={form.role}
                onChange={update}
                required
              >
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
              </select>

              <label htmlFor="branch">Branch</label>

              <select
                id="branch"
                name="branch"
                value={form.branch}
                onChange={update}
                required
              >
                <option value="CSE">CSE</option>
                <option value="CSE AI/ML">CSE AI/ML</option>
                <option value="CSE Data Science">CSE Data Science</option>
                <option value="CSE Cyber Security">CSE Cyber Security</option>
                <option value="IT">IT</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Civil">Civil</option>
                <option value="Other">Other</option>
              </select>

              {form.role === "STUDENT" && (
                <div className="auth-two-columns">
                  <div>
                    <label htmlFor="yearOfStudy">
                      Year of study
                    </label>

                    <select
                      id="yearOfStudy"
                      name="yearOfStudy"
                      value={form.yearOfStudy}
                      onChange={update}
                      required
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="semester">Semester</label>

                    <select
                      id="semester"
                      name="semester"
                      value={form.semester}
                      onChange={update}
                      required
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          <label htmlFor="email">Email address</label>

          <div className="auth-input">
            <Mail size={18} />

            <input
              id="email"
              type="email"
              name="email"
              value={form.email}
              onChange={update}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <label htmlFor="password">Password</label>

          <div className="auth-input">
            <Lock size={18} />

            <input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={update}
              placeholder={
                mode === "register"
                  ? "Create a strong password"
                  : "Enter your password"
              }
              autoComplete={
                mode === "register"
                  ? "new-password"
                  : "current-password"
              }
              minLength={mode === "register" ? 8 : undefined}
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() =>
                setShowPassword((previous) => !previous)
              }
              aria-label={
                showPassword ? "Hide password" : "Show password"
              }
              title={
                showPassword ? "Hide password" : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {mode === "register" && (
            <p className="password-hint">
              Use at least 8 characters, including an uppercase letter,
              a number, and a special symbol.
            </p>
          )}

          {error && (
            <div
              className={
                error.includes("Registration successful")
                  ? "auth-success"
                  : "auth-error"
              }
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>

          <p className="auth-switch">
            {mode === "login"
              ? "Don't have an account?"
              : "Already registered?"}

            <button type="button" onClick={switchMode}>
              {mode === "login" ? " Create account" : " Sign in"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
