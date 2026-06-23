import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";

// ─── CONSTANTS ────────────────────────────────────────────────
const API_BASE = `${API_BASE_URL}/api`;

const COLORS = {
  navy:      "#0A1628",
  navyMid:   "#0F2347",
  teal:      "#00C9A7",
  tealLight: "#E0FDF6",
  gold:      "#F5C842",
  white:     "#FAFBFF",
  offWhite:  "#F0F4FF",
  text:      "#0A1628",
  muted:     "#6B7A99",
  border:    "#DDE3F0",
  error:     "#E53E3E",
  errorBg:   "#FFF5F5",
  errorBorder:"#FEB2B2",
};

// ─── TYPES ────────────────────────────────────────────────────
interface PatientPayload {
  first_name:        string;
  last_name:         string;
  email:             string;
  password:          string;
  phone:             string;
}

interface DoctorPayload extends PatientPayload {
  license_number: string;
}

interface FieldErrors {
  first_name?:     string[];
  last_name?:      string[];
  email?:          string[];
  password?:       string[];
  phone?:          string[];
  license_number?: string[];
  non_field_errors?:string[];
  [key: string]: string[] | undefined;
}

// ─── STYLES ───────────────────────────────────────────────────
const GlobalRegisterStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: ${COLORS.white};
      color: ${COLORS.text};
      font-family: 'DM Sans', sans-serif;
      overflow-x: hidden;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%      { transform: translateX(-6px); }
      40%      { transform: translateX(6px); }
      60%      { transform: translateX(-4px); }
      80%      { transform: translateX(4px); }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.06); }
    }
    .logo-breathe { animation: breathe 3s ease-in-out infinite; }

    .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-shake    { animation: shake 0.4s ease; }

    .input-group { margin-bottom: 20px; text-align: left; }

    .input-label {
      font-size: 13px;
      font-weight: 600;
      color: ${COLORS.navy};
      display: block;
      margin-bottom: 8px;
    }

    .input-field {
      width: 100%;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1.5px solid ${COLORS.border};
      background: ${COLORS.white};
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      transition: all 0.2s;
      outline: none;
      color: ${COLORS.text};
    }

    .input-field:focus {
      border-color: ${COLORS.teal};
      box-shadow: 0 0 0 4px ${COLORS.teal}18;
    }

    .input-field.error {
      border-color: ${COLORS.error};
      background: ${COLORS.errorBg};
    }

    .input-field.error:focus {
      box-shadow: 0 0 0 4px ${COLORS.error}18;
    }

    .field-error {
      font-size: 12px;
      color: ${COLORS.error};
      margin-top: 5px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn-register {
      width: 100%;
      background: ${COLORS.teal};
      color: ${COLORS.navy};
      font-family: 'DM Sans', sans-serif;
      font-size: 16px;
      font-weight: 600;
      padding: 14px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      transition: all 0.25s;
      box-shadow: 0 4px 20px rgba(0,201,167,0.3);
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-register:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0,201,167,0.45);
    }

    .btn-register:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2.5px solid ${COLORS.navy}40;
      border-top-color: ${COLORS.navy};
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .register-card {
      background: ${COLORS.white};
      border: 1px solid ${COLORS.border};
      border-radius: 28px;
      padding: 40px 48px;
      width: 100%;
      max-width: 550px;
      box-shadow: 0 30px 70px rgba(10,22,40,0.06);
      position: relative;
      z-index: 2;
    }

    .role-select { display: flex; gap: 12px; margin-bottom: 30px; }

    .role-option {
      flex: 1;
      padding: 12px;
      border: 1.5px solid ${COLORS.border};
      border-radius: 12px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
      font-weight: 500;
      color: ${COLORS.muted};
    }

    .role-option.active {
      border-color: ${COLORS.teal};
      background: ${COLORS.teal}08;
      color: ${COLORS.teal};
      font-weight: 600;
    }

    .global-error {
      background: ${COLORS.errorBg};
      border: 1px solid ${COLORS.errorBorder};
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 13px;
      color: ${COLORS.error};
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .success-banner {
      background: #F0FDF9;
      border: 1px solid #6EE7CC;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: center;
      color: #065F46;
      font-size: 14px;
      font-weight: 500;
    }
  `}</style>
);

// ─── HELPERS ──────────────────────────────────────────────────

// Splits "Yash Patel" → { first_name: "Yash", last_name: "Patel" }
// If only one word is given → first_name = word, last_name = ""
function splitFullName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/);
  const first_name = parts[0] ?? "";
  const last_name  = parts.slice(1).join(" ");
  return { first_name, last_name };
}

// ─── COMPONENT ────────────────────────────────────────────────
const Register: React.FC = () => {
  const navigate = useNavigate();

  // ── Form state ──
  const [role, setRole]               = useState<"patient" | "doctor">("patient");
  const [fullName, setFullName]       = useState("");
  const [phone, setPhone]             = useState("");
  const [email, setEmail]             = useState("");
  const [licenseNumber, setLicense]   = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [agreed, setAgreed]           = useState(false);

  // ── UI state ──
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [shake, setShake]             = useState(false);

  // ── Role switch: clear all state ──
  const handleRoleSwitch = (newRole: "patient" | "doctor") => {
    setRole(newRole);
    setFieldErrors({});
    setGlobalError("");
    setSuccess(false);
  };

  // ── Client-side validation before hitting the API ──
  const validateLocally = (): boolean => {
    const errors: FieldErrors = {};

    if (!fullName.trim()) {
      errors.first_name = ["Full name is required."];
    }

    if (password.length < 8) {
      errors.password = ["Password must be at least 8 characters."];
    } else if (password !== confirmPassword) {
      errors.password = ["Passwords do not match."];
    }

    if (role === "doctor" && !licenseNumber.trim()) {
      errors.license_number = ["License number is required for doctors."];
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      triggerShake();
      return false;
    }

    return true;
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGlobalError("");

    if (!validateLocally()) return;

    const { first_name, last_name } = splitFullName(fullName);

    const endpoint =
      role === "patient"
        ? `${API_BASE}/auth/register/patient/`
        : `${API_BASE}/auth/register/doctor/`;

    const payload: PatientPayload | DoctorPayload =
      role === "patient"
        ? { first_name, last_name, email, password, phone }
        : { first_name, last_name, email, password, phone, license_number: licenseNumber };

    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // ── Success: show banner then redirect to login ──
        setSuccess(true);
        setTimeout(() => navigate("/login"), 2500);
      } else if (response.status === 400) {
        // ── Validation errors from Django serializer ──
        // Shape: { "email": ["already exists"], "password": ["too common"] }
        setFieldErrors(data as FieldErrors);
        triggerShake();
      } else {
        // ── Unexpected server error ──
        setGlobalError(
          data?.error ?? "Something went wrong. Please try again."
        );
        triggerShake();
      }
    } catch (err) {
      // ── Network error (server down, no internet) ──
      setGlobalError("Cannot reach the server. Check your connection.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // ─── RENDER ─────────────────────────────────────────────────
  return (
    <>
      <GlobalRegisterStyle />
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at 90% 10%, ${COLORS.teal}12 0%, transparent 40%), 
                     radial-gradient(circle at 10% 90%, ${COLORS.gold}12 0%, transparent 40%),
                     ${COLORS.white}`,
        padding: "40px 20px",
      }}>

        <div className={`register-card animate-slide-up ${shake ? "animate-shake" : ""}`}>

          {/* ── Header ── */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="logo-breathe" style={{
              width: 44, height: 44, borderRadius: 12,
              background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.navyMid})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, margin: "0 auto 16px",
            }}>📜</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: COLORS.navy }}>
              Join the Treasury
            </h1>
            <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4 }}>
              Start your journey toward organized health clarity
            </p>
          </div>

          {/* ── Role Selector ── */}
          <div className="role-select">
            {(["patient", "doctor"] as const).map((r) => (
              <div
                key={r}
                className={`role-option ${role === r ? "active" : ""}`}
                onClick={() => handleRoleSwitch(r)}
              >
                {r === "patient" ? "I am a Patient" : "I am a Doctor"}
              </div>
            ))}
          </div>

          {/* ── Success Banner ── */}
          {success && (
            <div className="success-banner">
              Account created successfully! Redirecting to login...
            </div>
          )}

          {/* ── Global Error Banner ── */}
          {globalError && (
            <div className="global-error">
              <span>⚠</span>
              <span>{globalError}</span>
            </div>
          )}

          {/* ── Form ── */}
          {!success && (
            <form onSubmit={handleSubmit} noValidate>

              {/* Full Name + Phone */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="input-group">
                  <label className="input-label">Full Name</label>
                  <input
                    type="text"
                    className={`input-field ${fieldErrors.first_name || fieldErrors.last_name ? "error" : ""}`}
                    placeholder="Yash Patel"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                  {(fieldErrors.first_name || fieldErrors.last_name) && (
                    <p className="field-error">
                      ⚠ {(fieldErrors.first_name ?? fieldErrors.last_name)![0]}
                    </p>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Contact Number</label>
                  <input
                    type="tel"
                    className={`input-field ${fieldErrors.phone ? "error" : ""}`}
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  {fieldErrors.phone && (
                    <p className="field-error">⚠ {fieldErrors.phone[0]}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="input-group">
                <label className="input-label">Email Address</label>
                <input
                  type="email"
                  className={`input-field ${fieldErrors.email ? "error" : ""}`}
                  placeholder="yash@nitj.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {fieldErrors.email && (
                  <p className="field-error">⚠ {fieldErrors.email[0]}</p>
                )}
              </div>

              {/* License Number — doctor only */}
              {role === "doctor" && (
                <div className="input-group">
                  <label className="input-label">Medical Registration Number (MCI/NMC)</label>
                  <input
                    type="text"
                    className={`input-field ${fieldErrors.license_number ? "error" : ""}`}
                    placeholder="MCI-12345"
                    value={licenseNumber}
                    onChange={(e) => setLicense(e.target.value)}
                    required
                  />
                  {fieldErrors.license_number && (
                    <p className="field-error">⚠ {fieldErrors.license_number[0]}</p>
                  )}
                </div>
              )}

              {/* Password + Confirm */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="input-group">
                  <label className="input-label">Password</label>
                  <input
                    type="password"
                    className={`input-field ${fieldErrors.password ? "error" : ""}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {fieldErrors.password && (
                    <p className="field-error">⚠ {fieldErrors.password[0]}</p>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Confirm Password</label>
                  <input
                    type="password"
                    className={`input-field ${
                      password && confirmPassword && password !== confirmPassword ? "error" : ""
                    }`}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="field-error">⚠ Passwords do not match</p>
                  )}
                </div>
              </div>

              {/* Terms checkbox */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "24px", alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  style={{ marginTop: "4px", cursor: "pointer" }}
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                />
                <p style={{ fontSize: "12px", color: COLORS.muted, lineHeight: "1.5" }}>
                  I agree to the RogNidhi{" "}
                  <span style={{ color: COLORS.teal, fontWeight: 600 }}>Terms of Service</span> and
                  acknowledge the{" "}
                  <span style={{ color: COLORS.teal, fontWeight: 600 }}>Privacy Policy</span> regarding my medical data.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn-register"
                disabled={loading || !agreed}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Creating your treasury...
                  </>
                ) : (
                  "Create My Health Treasury"
                )}
              </button>

            </form>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: "32px" }}>
            <p style={{ fontSize: "14px", color: COLORS.muted }}>
              Already have an account?{" "}
              <span
                onClick={() => navigate("/login")}
                style={{ color: COLORS.teal, fontWeight: 600, cursor: "pointer" }}
              >
                Sign In
              </span>
            </p>
          </div>
        </div>

        {/* Back Home */}
        <div
          onClick={() => navigate("/")}
          style={{
            position: "absolute", top: 40, left: 40, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            color: COLORS.muted, fontSize: 14, fontWeight: 500,
          }}
        >
          <span>←</span> Back
        </div>
      </div>
    </>
  );
};

export default Register;