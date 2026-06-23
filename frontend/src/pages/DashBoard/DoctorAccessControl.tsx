import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, UserCheck, Clock, CheckCircle, AlertCircle,
  Search, Shield, Users, Send, Mail,
  User, Activity, Droplets
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import NotificationDropdown from "../../components/NotificationDropdown";

import { API_BASE_URL } from "../../config";

// ─── CONSTANTS ────────────────────────────────────────────────
const API_BASE = `${API_BASE_URL}/api`;
const COLORS = {
  navy: "#0A1628",
  navyMid: "#112240",
  teal: "#00C9A7",
  tealLight: "#E0FDF6",
  muted: "#64748B",
  border: "#E2E8F0",
  danger: "#EF4444",
  dangerLight: "#FEF2F2",
  success: "#10B981",
  offWhite: "#F8FAFC",
  white: "#FFFFFF",
  amber: "#F59E0B",
  amberLight: "#FFFBEB",
  purple: "#8B5CF6",
  purpleLight: "#EDE9FE",
};

interface Patient {
  id: number;
  patient_id: number;
  status: "pending" | "active" | "revoked";
  granted_at: string;
  approved_at: string | null;
  patient_name: string;
  patient_email: string;
  blood_group: string | null;
}

const DoctorAccessControl: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("access") ?? "";
  const user = JSON.parse(localStorage.getItem("user") ?? "{}");

  const [tab, setTab] = useState<"active" | "pending" | "all">("active");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Auth guard ──
  useEffect(() => {
    if (!token || user.role !== "doctor") navigate("/login");
  }, [token, user.role, navigate]);

  // ── Fetch Logic ──
  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/access/my-patients/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPatients(data.results ?? []);
    } catch {
      showToast("Failed to load patient list.", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setRequesting(true);
    try {
      const res = await fetch(`${API_BASE}/access/request/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ patient_email: searchEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Access request sent. The patient will be notified.", "success");
        setSearchEmail("");
        await fetchPatients();
      } else {
        const errMsg =
          data?.patient_email?.[0] ??
          data?.non_field_errors?.[0] ??
          data?.error ??
          "Failed to send request.";
        showToast(errMsg, "error");
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setRequesting(false);
    }
  };

  if (!user.name) return null;

  const counts = {
    active: patients.filter(p => p.status === "active").length,
    pending: patients.filter(p => p.status === "pending").length,
    all: patients.length,
  };

  const filtered = patients.filter(p =>
    tab === "all" ? true : p.status === tab
  );

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); box-shadow: 0 2px 10px rgba(0,0,0,0.02); }
          50% { transform: scale(1.03); box-shadow: 0 6px 20px rgba(0,201,167,0.12); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .dac-stat-breathe { animation: breathe 3s ease-in-out infinite; }
        .bell-breathe { animation: pulse 2.5s ease-in-out infinite; }

        .dac-tab {
          position: relative;
          background: none;
          border: none;
          padding: 14px 24px;
          font-size: 14px;
          font-weight: 600;
          color: ${COLORS.muted};
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 10px;
          border-radius: 12px;
          font-family: inherit;
        }
        .dac-tab:hover {
          background: rgba(0, 201, 167, 0.06);
          color: ${COLORS.navy};
        }
        .dac-tab.active {
          background: ${COLORS.white};
          color: ${COLORS.navy};
          font-weight: 700;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }

        .dac-card {
          background: ${COLORS.white};
          border: 1px solid ${COLORS.border};
          border-radius: 18px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInUp 0.4s ease-out both;
        }
        .dac-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
          border-color: ${COLORS.teal}40;
        }

        .dac-request-input {
          flex: 1;
          padding: 14px 18px;
          border: 1.5px solid ${COLORS.border};
          border-radius: 14px;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: all 0.25s;
          color: ${COLORS.navy};
          background: ${COLORS.white};
        }
        .dac-request-input:focus {
          border-color: ${COLORS.teal};
          box-shadow: 0 0 0 4px rgba(0, 201, 167, 0.1);
        }
        .dac-request-input::placeholder {
          color: ${COLORS.muted};
        }

        .dac-send-btn {
          background: linear-gradient(135deg, ${COLORS.teal}, #00B894);
          color: ${COLORS.navy};
          border: none;
          padding: 14px 28px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 14px rgba(0, 201, 167, 0.25);
          font-family: inherit;
          white-space: nowrap;
        }
        .dac-send-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 201, 167, 0.35);
        }
        .dac-send-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>

      {/* ── Sidebar ── */}
      <Sidebar user={user} />

      {/* ── Main Content ── */}
      <main style={styles.main}>
        {/* Top Bar */}
        <header style={styles.header}>
          <div style={styles.searchBar}>
            <Search size={18} color={COLORS.muted} />
            <input
              type="text"
              placeholder="Search patients..."
              style={styles.searchInput}
            />
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <NotificationDropdown />
          </div>
        </header>

        {/* Page Content */}
        <div style={styles.contentArea}>
          {/* Hero */}
          <div style={{ animation: "fadeInUp 0.5s ease-out" }}>
            <div style={styles.heroSection}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                  <div style={styles.heroIconWrap}>
                    <Shield size={22} color={COLORS.teal} />
                  </div>
                  <h1 style={styles.pageTitle}>Patient Access</h1>
                </div>
                <p style={styles.pageSubtitle}>
                  Request access to patient records and track the status of your requests.
                </p>
              </div>
            </div>

            {/* Stat Cards */}
            <div style={styles.statsRow}>
              <div className="dac-stat-breathe" style={{
                ...styles.statCard,
                borderLeft: `4px solid ${COLORS.teal}`,
              }}>
                <div style={styles.statIconWrap}>
                  <UserCheck size={20} color={COLORS.teal} />
                </div>
                <div>
                  <div style={styles.statNumber}>{counts.active}</div>
                  <div style={styles.statLabel}>Active Patients</div>
                </div>
              </div>

              <div className="dac-stat-breathe" style={{
                ...styles.statCard,
                borderLeft: `4px solid ${COLORS.amber}`,
              }}>
                <div style={{ ...styles.statIconWrap, background: COLORS.amberLight }}>
                  <Clock size={20} color={COLORS.amber} />
                </div>
                <div>
                  <div style={styles.statNumber}>{counts.pending}</div>
                  <div style={styles.statLabel}>Pending Requests</div>
                </div>
              </div>

              <div className="dac-stat-breathe" style={{
                ...styles.statCard,
                borderLeft: `4px solid ${COLORS.purple}`,
              }}>
                <div style={{ ...styles.statIconWrap, background: COLORS.purpleLight }}>
                  <Users size={20} color={COLORS.purple} />
                </div>
                <div>
                  <div style={styles.statNumber}>{counts.all}</div>
                  <div style={styles.statLabel}>Total Connections</div>
                </div>
              </div>
            </div>
          </div>

          {/* Request Access Card */}
          <div style={{
            ...styles.requestCard,
            animation: "fadeInUp 0.5s ease-out 0.1s both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <Mail size={18} color={COLORS.teal} />
              <h3 style={{ fontSize: 17, fontWeight: 700, color: COLORS.navy, margin: 0 }}>
                Request Patient Access
              </h3>
            </div>
            <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: 20, lineHeight: 1.5 }}>
              Enter the patient's registered email. They'll be notified and must approve before you can view their records.
            </p>

            <form onSubmit={handleRequest} style={{ display: "flex", gap: 12 }} noValidate>
              <input
                className="dac-request-input"
                type="email"
                placeholder="patient@example.com"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                className="dac-send-btn"
                disabled={requesting || !searchEmail.trim()}
              >
                {requesting ? (
                  <>
                    <div style={{
                      width: 16, height: 16,
                      border: `2px solid rgba(10,22,40,0.3)`,
                      borderTopColor: COLORS.navy,
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }} />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Send Request
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Tab Bar */}
          <div style={styles.tabBar}>
            {(["active", "pending", "all"] as const).map(t => (
              <button
                key={t}
                className={`dac-tab ${tab === t ? "active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "active" && <UserCheck size={15} />}
                {t === "pending" && <Clock size={15} />}
                {t === "all" && <Users size={15} />}
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                <span style={{
                  ...(t === "pending" && counts.pending > 0
                    ? { background: COLORS.amber, color: "#fff", animation: "pulse 2s ease-in-out infinite" }
                    : t === "active"
                    ? { background: COLORS.teal, color: COLORS.navy }
                    : { background: COLORS.offWhite, color: COLORS.muted }),
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 10,
                  lineHeight: "16px",
                }}>
                  {counts[t]}
                </span>
              </button>
            ))}
          </div>

          {/* Content List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loading ? (
              <div style={styles.emptyState}>
                <div style={{
                  width: 20, height: 20,
                  border: `3px solid ${COLORS.border}`,
                  borderTopColor: COLORS.teal,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 12px",
                }} />
                <span style={{ color: COLORS.muted, fontWeight: 600, fontSize: 14 }}>
                  Loading patients...
                </span>
              </div>
            ) : filtered.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIconWrap}>
                  {tab === "active" ? (
                    <UserCheck size={36} color={COLORS.border} />
                  ) : tab === "pending" ? (
                    <Clock size={36} color={COLORS.border} />
                  ) : (
                    <Users size={36} color={COLORS.border} />
                  )}
                </div>
                <h3 style={{ color: COLORS.navy, fontSize: 17, fontWeight: 700, margin: "16px 0 6px" }}>
                  {tab === "active" ? "No active patients yet" :
                   tab === "pending" ? "No pending requests" : "No patients found"}
                </h3>
                <p style={{ color: COLORS.muted, fontSize: 14, margin: 0, maxWidth: 340, lineHeight: 1.6 }}>
                  {tab === "active"
                    ? "Send a request to a patient using the form above to get started."
                    : tab === "pending"
                    ? "All your requests have been resolved."
                    : "Use the form above to request access to a patient's records."}
                </p>
              </div>
            ) : (
              filtered.map((patient, index) => {
                const isActive = patient.status === "active";
                const isPending = patient.status === "pending";

                return (
                  <div
                    key={patient.id}
                    className="dac-card"
                    style={{ animationDelay: `${index * 0.06}s` }}
                  >
                    {/* Patient Info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: isActive
                          ? `linear-gradient(135deg, ${COLORS.tealLight}, #D1FAE5)`
                          : isPending
                          ? `linear-gradient(135deg, ${COLORS.amberLight}, #FEF3C7)`
                          : `linear-gradient(135deg, #F1F5F9, #E2E8F0)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <span style={{
                          fontSize: 15, fontWeight: 800,
                          color: isActive ? COLORS.teal : isPending ? COLORS.amber : COLORS.muted,
                        }}>
                          {getInitials(patient.patient_name)}
                        </span>
                      </div>
                      <div>
                        <h4 style={{
                          margin: 0, fontSize: 15, fontWeight: 700,
                          color: COLORS.navy, letterSpacing: "-0.3px",
                        }}>
                          {patient.patient_name}
                        </h4>
                        <div style={{
                          display: "flex", gap: 14, marginTop: 5,
                          fontSize: 12, color: COLORS.muted,
                        }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <Mail size={12} />
                            {patient.patient_email}
                          </span>
                          {patient.blood_group && (
                            <span style={{
                              display: "flex", alignItems: "center", gap: 4,
                              background: COLORS.offWhite,
                              padding: "1px 8px",
                              borderRadius: 6,
                              fontWeight: 700,
                              fontSize: 11,
                            }}>
                              <Droplets size={11} />
                              {patient.blood_group}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: COLORS.muted,
                          textTransform: "uppercase", letterSpacing: "0.6px",
                        }}>
                          {isActive ? "Approved" : "Requested"}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.navy, marginTop: 2 }}>
                          {new Date(isActive ? (patient.approved_at ?? patient.granted_at) : patient.granted_at)
                            .toLocaleDateString("en-US", {
                              month: "short", day: "numeric", year: "numeric",
                            })}
                        </div>
                      </div>

                      <div style={{
                        background: isActive
                          ? `${COLORS.teal}18`
                          : isPending
                          ? `${COLORS.amber}20`
                          : `${COLORS.muted}15`,
                        color: isActive ? COLORS.teal : isPending ? COLORS.amber : COLORS.muted,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "5px 14px",
                        borderRadius: 20,
                      }}>
                        {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Global Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 32, right: 32, zIndex: 1000,
          background: toast.type === "success"
            ? `linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyMid})`
            : `linear-gradient(135deg, ${COLORS.danger}, #DC2626)`,
          color: "#fff", padding: "16px 28px", borderRadius: 16,
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
          animation: "toastIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          {toast.type === "success" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span style={{ fontWeight: 600, fontSize: 14 }}>{toast.msg}</span>
        </div>
      )}
    </div>
  );
};

// ─── STYLES ───────────────────────────────────────────────────
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: COLORS.offWhite,
  },
  main: {
    flexGrow: 1,
    marginLeft: 260,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  header: {
    height: 80,
    padding: "0 40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(12px)",
    position: "sticky",
    top: 0,
    zIndex: 90,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  searchBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: COLORS.white,
    padding: "10px 18px",
    borderRadius: 14,
    width: 380,
    border: `1px solid ${COLORS.border}`,
  },
  searchInput: {
    border: "none",
    background: "transparent",
    outline: "none",
    fontSize: 14,
    fontWeight: 500,
    width: "100%",
    fontFamily: "inherit",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: COLORS.white,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${COLORS.border}`,
    cursor: "pointer",
  },
  contentArea: {
    padding: 40,
    maxWidth: 1100,
    width: "100%",
    margin: "0 auto",
  },
  heroSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 32,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: COLORS.tealLight,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: 800,
    color: COLORS.navy,
    letterSpacing: "-0.8px",
    margin: 0,
  },
  pageSubtitle: {
    color: COLORS.muted,
    fontSize: 15,
    marginTop: 4,
    fontWeight: 400,
    lineHeight: 1.5,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 20,
    marginBottom: 32,
  },
  statCard: {
    background: COLORS.white,
    borderRadius: 18,
    padding: "22px 24px",
    border: `1px solid ${COLORS.border}`,
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: COLORS.tealLight,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 800,
    color: COLORS.navy,
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.muted,
    marginTop: 4,
    textTransform: "uppercase" as const,
    letterSpacing: "0.4px",
  },
  requestCard: {
    background: COLORS.white,
    borderRadius: 22,
    padding: "28px 32px",
    border: `1px solid ${COLORS.border}`,
    marginBottom: 28,
    boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
  },
  tabBar: {
    display: "flex",
    gap: 8,
    marginBottom: 24,
    background: COLORS.offWhite,
    border: `1px solid ${COLORS.border}`,
    padding: 6,
    borderRadius: 16,
    width: "fit-content",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: 70,
    background: COLORS.white,
    borderRadius: 24,
    border: `1px dashed ${COLORS.border}`,
    animation: "fadeInUp 0.5s ease-out",
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    background: COLORS.offWhite,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export default DoctorAccessControl;