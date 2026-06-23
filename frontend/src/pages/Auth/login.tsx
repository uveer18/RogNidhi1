import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";

// ─── CONSTANTS ────────────────────────────────────────────────
// Ensure this matches your backend server address
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
  errorBorder: "#FEB2B2",
};

// ─── TYPES ────────────────────────────────────────────────────
interface LoginResponse {
  access:  string;
  refresh: string;
  user: {
    id:      number;
    name:    string;
    email:   string;
    role:    "patient" | "doctor";
    profile: Record<string, any>;
  };
  error?: string; 
}

// ─── STYLES ───────────────────────────────────────────────────
const GlobalLoginStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Outfit:wght@300;400;500;600&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: ${COLORS.white};
      color: ${COLORS.text};
      font-family: 'Outfit', sans-serif;
      overflow: hidden;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
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
      0%, 100% { transform: scale(1); box-shadow: 0 10px 20px ${COLORS.teal}33; }
      50% { transform: scale(1.06); box-shadow: 0 14px 28px ${COLORS.teal}44; }
    }
    .logo-breathe { animation: breathe 3s ease-in-out infinite; }

    .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-shake     { animation: shake 0.4s ease; }

    .input-field {
      width: 100%;
      padding: 14px 16px;
      border-radius: 12px;
      border: 1.5px solid ${COLORS.border};
      background: ${COLORS.white};
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      transition: all 0.2s;
      outline: none;
      margin-bottom: 6px;
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

    .field-error {
      font-size: 12px;
      color: ${COLORS.error};
      margin-bottom: 14px;
      font-weight: 500;
    }

    .btn-login {
      width: 100%;
      background: ${COLORS.teal};
      color: ${COLORS.navy};
      font-family: 'Outfit', sans-serif;
      font-size: 16px;
      font-weight: 600;
      padding: 14px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 4px 20px rgba(0,201,167,0.3);
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }

    .btn-login:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 28px rgba(0,201,167,0.4);
    }

    .btn-login:disabled {
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

    .login-card {
      background: ${COLORS.white};
      border: 1px solid ${COLORS.border};
      border-radius: 28px;
      padding: 48px;
      width: 100%;
      max-width: 450px;
      box-shadow: 0 20px 60px rgba(10,22,40,0.08);
      position: relative;
      z-index: 2;
    }

    .role-tab {
      flex: 1;
      padding: 10px;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 10px;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .role-active   { background: ${COLORS.navy}; color: ${COLORS.white}; }
    .role-inactive { color: ${COLORS.muted}; }

    .error-banner {
      background: ${COLORS.errorBg};
      border: 1px solid ${COLORS.errorBorder};
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 20px;
      font-size: 13px;
      color: ${COLORS.error};
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
  `}</style>
);

// ─── COMPONENT ────────────────────────────────────────────────
const Login: React.FC = () => {
  const navigate = useNavigate();

  const [role, setRole]         = useState<"patient" | "doctor">("patient");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading]         = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [emailError, setEmailError]   = useState("");
  const [shake, setShake]             = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const clearErrors = () => {
    setGlobalError("");
    setEmailError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (!email.trim() || !password.trim()) {
      setGlobalError("Please fill in all fields.");
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      // Endpoint matches the Python services/views logic
      const response = await fetch(`${API_BASE}/auth/login/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ 
            email: email.toLowerCase().trim(), 
            password: password 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 1. Persist Session in LocalStorage
        localStorage.setItem("access",  data.access);
        localStorage.setItem("refresh", data.refresh);
        localStorage.setItem("user",    JSON.stringify(data.user));

        // 2. Dashboard Logic: Redirect based on the role stored in the DB
        // We use the role from the API response (data.user.role) 
        // rather than the UI toggle for security.
        if (data.user.role === "patient") {
          navigate("/DashBoard/PatientDashboard");
        } else if (data.user.role === "doctor") {
          navigate("/DashBoard/DoctorDashboard");
        } else {
          setGlobalError("User role mismatch. Contact support.");
          triggerShake();
        }

      } else if (response.status === 401) {
        setGlobalError(data?.error || "Invalid email or password.");
        triggerShake();

      } else if (response.status === 400) {
        if (data.email) setEmailError(data.email[0]);
        else setGlobalError(data.error || "Please check your credentials.");
        triggerShake();

      } else {
        setGlobalError("Server encountered an error.");
        triggerShake();
      }

    } catch (err) {
      setGlobalError("Network error. Please ensure the backend is running.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GlobalLoginStyle />
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at 0% 0%, ${COLORS.teal}10 0%, transparent 40%), 
                     radial-gradient(circle at 100% 100%, ${COLORS.gold}10 0%, transparent 40%),
                     ${COLORS.white}`,
        padding: "20px",
      }}>

        <div className={`login-card animate-slide-up ${shake ? "animate-shake" : ""}`}>
          
          {/* Brand Header */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="logo-breathe" style={{
              width: 54, height: 54, borderRadius: 16,
              background: `linear-gradient(135deg, ${COLORS.teal}, ${COLORS.navyMid})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26, margin: "0 auto 16px",
              boxShadow: `0 10px 20px ${COLORS.teal}33`
            }}>📋</div>
            <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 32, color: COLORS.navy, letterSpacing: "-1px" }}>
              Welcome Back
            </h1>
            <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 4, fontWeight: 500 }}>
              Access your digital health treasury
            </p>
          </div>

          {/* Role Switcher (Visual Hint) */}
          <div style={{
            display: "flex", background: COLORS.offWhite,
            padding: 6, borderRadius: 14, marginBottom: 32,
          }}>
            {(["patient", "doctor"] as const).map((r) => (
              <div
                key={r}
                className={`role-tab ${role === r ? "role-active" : "role-inactive"}`}
                onClick={() => { setRole(r); clearErrors(); }}
              >
                {r === "patient" ? "Patient" : "Doctor"}
              </div>
            ))}
          </div>

          {globalError && (
            <div className="error-banner">
              <span>⚠️</span>
              <span>{globalError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} noValidate>
            {/* Email Field */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, display: "block", marginBottom: 8 }}>
                Email Address
              </label>
              <input
                type="email"
                className={`input-field ${emailError ? "error" : ""}`}
                placeholder="yash@nitj.ac.in"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                required
              />
              {emailError && <p className="field-error">{emailError}</p>}
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy }}>Password</label>
                <span style={{ fontSize: 12, color: COLORS.teal, fontWeight: 700, cursor: "pointer" }}>Forgot?</span>
              </div>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearErrors(); }}
                required
              />
            </div>

            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Authenticating...
                </>
              ) : (
                "Sign In to RogNidhi"
              )}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <p style={{ fontSize: 14, color: COLORS.muted, fontWeight: 500 }}>
              New here?{" "}
              <span
                onClick={() => navigate("/register")}
                style={{ color: COLORS.teal, fontWeight: 700, cursor: "pointer" }}
              >
                Create Account
              </span>
            </p>
          </div>
        </div>

        {/* Home Navigation */}
        <div
          onClick={() => navigate("/")}
          style={{
            position: "absolute", top: 40, left: 40, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 8,
            color: COLORS.muted, fontSize: 14, fontWeight: 600,
          }}
        >
          <span>←</span> Back to Home
        </div>
      </div>
    </>
  );
};

export default Login;