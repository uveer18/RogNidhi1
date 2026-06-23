import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Search, Activity, FileText, Eye,
  Clock, CheckCircle, AlertCircle, Stethoscope,
  ChevronRight, UserCheck, Shield, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  white: "#FFFFFF",
  offWhite: "#F8FAFC",
  muted: "#64748B",
  border: "#E2E8F0",
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

const DoctorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      if (parsed.role !== "doctor") navigate("/login");
    } else {
      navigate("/login");
    }
  }, [navigate]);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE}/access/my-patients/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPatients(data.results ?? []);
    } catch {
      console.error("Failed to fetch patients");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchPatients();
  }, [user, fetchPatients]);

  if (!user) return null;

  const activePatients = patients.filter(p => p.status === "active");
  const pendingPatients = patients.filter(p => p.status === "pending");

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

        .doc-stat-breathe { animation: breathe 3s ease-in-out infinite; }
        .bell-breathe { animation: pulse 2.5s ease-in-out infinite; }

        .doc-patient-card {
          background: ${COLORS.white};
          border: 1px solid ${COLORS.border};
          border-radius: 18px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInUp 0.4s ease-out both;
          cursor: pointer;
        }
        .doc-patient-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
          border-color: ${COLORS.teal}40;
        }

        .doc-view-btn {
          background: linear-gradient(135deg, ${COLORS.teal}, #00B894);
          color: ${COLORS.navy};
          border: none;
          padding: 8px 18px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 14px rgba(0, 201, 167, 0.25);
        }
        .doc-view-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 201, 167, 0.35);
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
              placeholder="Search patients, records..."
              style={styles.searchInput}
            />
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <NotificationDropdown />
          </div>
        </header>

        {/* Page Content */}
        <div style={styles.contentArea}>
          {/* Hero Section */}
          <div style={{ animation: "fadeInUp 0.5s ease-out" }}>
            <div style={styles.heroSection}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                  <div style={styles.heroIconWrap}>
                    <Stethoscope size={22} color={COLORS.teal} />
                  </div>
                  <h1 style={styles.pageTitle}>
                    Welcome, Dr. {user.name?.split(" ")[0]}
                  </h1>
                </div>
                <p style={styles.pageSubtitle}>
                  Your clinical overview — manage patients and view AI-powered summaries.
                </p>
              </div>
            </div>

            {/* Stat Cards */}
            <div style={styles.statsRow}>
              <div className="doc-stat-breathe" style={{
                ...styles.statCard,
                borderLeft: `4px solid ${COLORS.teal}`,
              }}>
                <div style={styles.statIconWrap}>
                  <UserCheck size={20} color={COLORS.teal} />
                </div>
                <div>
                  <div style={styles.statNumber}>{activePatients.length}</div>
                  <div style={styles.statLabel}>Active Patients</div>
                </div>
              </div>

              <div className="doc-stat-breathe" style={{
                ...styles.statCard,
                borderLeft: `4px solid ${COLORS.amber}`,
              }}>
                <div style={{ ...styles.statIconWrap, background: COLORS.amberLight }}>
                  <Clock size={20} color={COLORS.amber} />
                </div>
                <div>
                  <div style={styles.statNumber}>{pendingPatients.length}</div>
                  <div style={styles.statLabel}>Pending Requests</div>
                </div>
              </div>

              <div className="doc-stat-breathe" style={{
                ...styles.statCard,
                borderLeft: `4px solid ${COLORS.purple}`,
              }}>
                <div style={{ ...styles.statIconWrap, background: COLORS.purpleLight }}>
                  <Shield size={20} color={COLORS.purple} />
                </div>
                <div>
                  <div style={styles.statNumber}>{patients.length}</div>
                  <div style={styles.statLabel}>Total Connections</div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Patients Section */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={styles.sectionHeading}>
                <Users size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Active Patients
              </h3>
              <span
                onClick={fetchPatients}
                style={{ fontSize: 13, color: COLORS.teal, fontWeight: 700, cursor: "pointer" }}
              >
                Refresh
              </span>
            </div>

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
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  <span style={{ color: COLORS.muted, fontWeight: 600, fontSize: 14 }}>
                    Loading patients...
                  </span>
                </div>
              ) : activePatients.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIconWrap}>
                    <Users size={36} color={COLORS.border} />
                  </div>
                  <h3 style={{ color: COLORS.navy, fontSize: 17, fontWeight: 700, margin: "16px 0 6px" }}>
                    No active patients yet
                  </h3>
                  <p style={{ color: COLORS.muted, fontSize: 14, margin: 0, maxWidth: 340, lineHeight: 1.6 }}>
                    Request access to a patient's records from the{" "}
                    <span
                      style={{ color: COLORS.teal, fontWeight: 700, cursor: "pointer" }}
                      onClick={() => navigate("/doctor-access-control")}
                    >
                      Access Control
                    </span>{" "}
                    page to get started.
                  </p>
                </div>
              ) : (
                activePatients.map((patient, index) => (
                  <div
                    key={patient.id}
                    className="doc-patient-card"
                    style={{ animationDelay: `${index * 0.06}s` }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: `linear-gradient(135deg, ${COLORS.tealLight}, #D1FAE5)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.teal }}>
                          {patient.patient_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h4 style={{
                          margin: 0, fontSize: 15, fontWeight: 700,
                          color: COLORS.navy, letterSpacing: "-0.3px",
                        }}>
                          {patient.patient_name}
                        </h4>
                        <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 12, color: COLORS.muted }}>
                          <span>{patient.patient_email}</span>
                          {patient.blood_group && (
                            <span style={{
                              background: COLORS.offWhite,
                              padding: "1px 8px",
                              borderRadius: 6,
                              fontWeight: 700,
                              fontSize: 11,
                            }}>
                              {patient.blood_group}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: COLORS.muted,
                          textTransform: "uppercase", letterSpacing: "0.6px",
                        }}>
                          Approved
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.navy, marginTop: 2 }}>
                          {patient.approved_at
                            ? new Date(patient.approved_at).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric",
                              })
                            : "—"}
                        </div>
                      </div>
                      <button
                        className="doc-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/doctor/patient-records/${patient.patient_id}`);
                        }}
                      >
                        <Eye size={14} />
                        View Records
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pending Requests Section */}
          {pendingPatients.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={styles.sectionHeading}>
                  <Clock size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />
                  Pending Requests
                  <span style={{
                    background: COLORS.amber,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 10,
                    marginLeft: 10,
                    animation: "pulse 2s ease-in-out infinite",
                  }}>
                    {pendingPatients.length}
                  </span>
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pendingPatients.map((patient, index) => (
                  <div
                    key={patient.id}
                    className="doc-patient-card"
                    style={{ animationDelay: `${index * 0.06}s` }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: `linear-gradient(135deg, ${COLORS.amberLight}, #FEF3C7)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.amber }}>
                          {patient.patient_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <h4 style={{
                          margin: 0, fontSize: 15, fontWeight: 700,
                          color: COLORS.navy, letterSpacing: "-0.3px",
                        }}>
                          {patient.patient_name}
                        </h4>
                        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
                          {patient.patient_email}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: COLORS.muted,
                          textTransform: "uppercase", letterSpacing: "0.6px",
                        }}>
                          Requested
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.navy, marginTop: 2 }}>
                          {new Date(patient.granted_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                        </div>
                      </div>
                      <div style={{
                        background: `${COLORS.amber}20`,
                        color: COLORS.amber,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "4px 12px",
                        borderRadius: 20,
                      }}>
                        Pending
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
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
    marginBottom: 40,
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
  sectionHeading: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.navy,
    margin: 0,
    display: "flex",
    alignItems: "center",
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

export default DoctorDashboard;