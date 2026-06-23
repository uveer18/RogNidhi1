import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, UserCheck, Clock, Trash2, CheckCircle, PlusCircle, AlertCircle, RefreshCw, XCircle, Search, 
  ChevronRight, Activity, Bell, Shield, Users, UserX, User, Hospital
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
};

interface Permission {
  id: number;
  status: "pending" | "active" | "revoked";
  granted_at: string;
  approved_at: string | null;
  doctor_name: string;
  doctor_email: string;
  doctor_specialization: string | null;
  doctor_hospital: string | null;
}

const PatientAccessControl: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("access") ?? "";
  const user = JSON.parse(localStorage.getItem("user") ?? "{}");

  const [tab, setTab] = useState<"pending" | "active">("pending");
  const [pending, setPending] = useState<Permission[]>([]);
  const [active, setActive] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Auth guard ──
  useEffect(() => {
    if (!token || user.role !== "patient") navigate("/login");
  }, [token, user.role, navigate]);

  // ── Fetch Logic ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [pendRes, activeRes] = await Promise.all([
        fetch(`${API_BASE}/access/pending/`, { headers }),
        fetch(`${API_BASE}/access/my-doctors/`, { headers }),
      ]);
      const pendData = await pendRes.json();
      const activeData = await activeRes.json();

      setPending(pendData.results ?? []);
      setActive(activeData.results ?? []);
    } catch {
      showToast("Failed to load access data.", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleApprove = async (id: number) => {
    setActionId(id);
    try {
      const res = await fetch(`${API_BASE}/access/approve/${id}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("Access granted successfully.", "success");
        await fetchAll();
      } else {
        showToast("Approval failed.", "error");
      }
    } catch {
      showToast("Network error.", "error");
    } finally {
      setActionId(null);
    }
  };

  const handleRevoke = async (id: number) => {
    if (!window.confirm("Revoke this doctor's access?")) return;
    setActionId(id);
    try {
      const res = await fetch(`${API_BASE}/access/revoke/${id}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast("Access revoked.", "success");
        await fetchAll();
      }
    } catch {
      showToast("Revoke failed.", "error");
    } finally {
      setActionId(null);
    }
  };

  if (!user.name) return null;

  const currentList = tab === "pending" ? pending : active;

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .ac-tab {
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
        }
        .ac-tab:hover {
          background: rgba(0, 201, 167, 0.06);
          color: ${COLORS.navy};
        }
        .ac-tab.active {
          background: ${COLORS.white};
          color: ${COLORS.navy};
          font-weight: 700;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }

        .ac-card {
          background: ${COLORS.white};
          border: 1px solid ${COLORS.border};
          border-radius: 20px;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInUp 0.4s ease-out both;
          cursor: default;
        }
        .ac-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
          border-color: ${COLORS.teal}40;
        }

        .ac-approve-btn {
          background: linear-gradient(135deg, ${COLORS.teal}, #00B894);
          color: ${COLORS.navy};
          border: none;
          padding: 10px 24px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 14px rgba(0, 201, 167, 0.25);
        }
        .ac-approve-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 201, 167, 0.35);
        }
        .ac-approve-btn:active { transform: translateY(0); }
        .ac-approve-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .ac-revoke-btn {
          background: transparent;
          border: 1px solid #FED7D7;
          color: ${COLORS.danger};
          padding: 10px 24px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.25s ease;
        }
        .ac-revoke-btn:hover {
          background: ${COLORS.dangerLight};
          border-color: ${COLORS.danger}40;
          transform: translateY(-1px);
        }
        .ac-revoke-btn:active { transform: translateY(0); }
        .ac-revoke-btn:disabled { opacity: 0.6; cursor: not-allowed; }
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
              placeholder="Search doctors, permissions..."
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
                    <Shield size={22} color={COLORS.teal} />
                  </div>
                  <h1 style={styles.pageTitle}>Access Control</h1>
                </div>
                <p style={styles.pageSubtitle}>
                  Manage which healthcare professionals can view your medical treasury.
                </p>
              </div>
            </div>

            {/* Stat Cards */}
            <div style={styles.statsRow}>
              <div style={{
                ...styles.statCard,
                borderLeft: `4px solid ${COLORS.amber}`,
              }}>
                <div style={styles.statIconWrap}>
                  <Clock size={20} color={COLORS.amber} />
                </div>
                <div>
                  <div style={styles.statNumber}>{pending.length}</div>
                  <div style={styles.statLabel}>Pending Requests</div>
                </div>
              </div>

              <div style={{
                ...styles.statCard,
                borderLeft: `4px solid ${COLORS.teal}`,
              }}>
                <div style={{ ...styles.statIconWrap, background: COLORS.tealLight }}>
                  <UserCheck size={20} color={COLORS.teal} />
                </div>
                <div>
                  <div style={styles.statNumber}>{active.length}</div>
                  <div style={styles.statLabel}>Authorized Doctors</div>
                </div>
              </div>

              <div style={{
                ...styles.statCard,
                borderLeft: `4px solid ${COLORS.navy}`,
              }}>
                <div style={{ ...styles.statIconWrap, background: "#EEF2FF" }}>
                  <ShieldCheck size={20} color={COLORS.navy} />
                </div>
                <div>
                  <div style={styles.statNumber}>{pending.length + active.length}</div>
                  <div style={styles.statLabel}>Total Permissions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Bar */}
          <div style={styles.tabBar}>
            <button
              className={`ac-tab ${tab === "pending" ? "active" : ""}`}
              onClick={() => setTab("pending")}
            >
              <Clock size={16} />
              Pending Requests
              {pending.length > 0 && (
                <span style={styles.badge}>{pending.length}</span>
              )}
            </button>
            <button
              className={`ac-tab ${tab === "active" ? "active" : ""}`}
              onClick={() => setTab("active")}
            >
              <UserCheck size={16} />
              Authorized Doctors
              {active.length > 0 && (
                <span style={{ ...styles.badge, background: COLORS.teal, color: COLORS.navy }}>
                  {active.length}
                </span>
              )}
            </button>
          </div>

          {/* Content List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {loading ? (
              <div style={styles.emptyState}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 20, height: 20,
                    border: `3px solid ${COLORS.border}`,
                    borderTopColor: COLORS.teal,
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <span style={{ color: COLORS.muted, fontWeight: 600, fontSize: 14 }}>
                    Loading permissions...
                  </span>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : currentList.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIconWrap}>
                  {tab === "pending" ? (
                    <Clock size={40} color={COLORS.border} />
                  ) : (
                    <Users size={40} color={COLORS.border} />
                  )}
                </div>
                <h3 style={{ color: COLORS.navy, fontSize: 18, fontWeight: 700, margin: "16px 0 6px" }}>
                  {tab === "pending" ? "No pending requests" : "No authorized doctors"}
                </h3>
                <p style={{ color: COLORS.muted, fontSize: 14, margin: 0, maxWidth: 320, lineHeight: 1.6 }}>
                  {tab === "pending"
                    ? "When a doctor requests access to your records, it will appear here for your approval."
                    : "Approve a pending request to grant a doctor access to your medical treasury."}
                </p>
              </div>
            ) : (
              currentList.map((perm, index) => (
                <div
                  key={perm.id}
                  className="ac-card"
                  style={{ animationDelay: `${index * 0.06}s` }}
                >
                  {/* Doctor Info */}
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 16,
                      background: tab === "active"
                        ? `linear-gradient(135deg, ${COLORS.tealLight}, #D1FAE5)`
                        : `linear-gradient(135deg, ${COLORS.amberLight}, #FEF3C7)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <User size={22} color={tab === "active" ? COLORS.teal : COLORS.amber} />
                    </div>
                    <div>
                      <h3 style={{
                        margin: 0, fontSize: 16, fontWeight: 700,
                        color: COLORS.navy, letterSpacing: "-0.3px",
                      }}>
                        Dr. {perm.doctor_name}
                      </h3>
                      <div style={{
                        display: "flex", gap: 16, marginTop: 6,
                        fontSize: 13, color: COLORS.muted,
                      }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Activity size={13} />
                          {perm.doctor_specialization || "General Physician"}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Hospital size={13} />
                          {perm.doctor_hospital || "Private Clinic"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Date + Action */}
                  <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{ textAlign: "right", marginRight: 4 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: COLORS.muted,
                        textTransform: "uppercase", letterSpacing: "0.6px",
                      }}>
                        {tab === "pending" ? "Requested" : "Granted"}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy, marginTop: 3 }}>
                        {new Date(perm.granted_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </div>
                    </div>

                    {tab === "pending" ? (
                      <button
                        className="ac-approve-btn"
                        onClick={() => handleApprove(perm.id)}
                        disabled={actionId === perm.id}
                      >
                        {actionId === perm.id ? "Processing..." : <><CheckCircle size={16} /> Approve</>}
                      </button>
                    ) : (
                      <button
                        className="ac-revoke-btn"
                        onClick={() => handleRevoke(perm.id)}
                        disabled={actionId === perm.id}
                      >
                        <Trash2 size={16} /> Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))
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
    background: COLORS.amberLight,
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
  badge: {
    background: COLORS.danger,
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    padding: "2px 8px",
    borderRadius: 10,
    lineHeight: "16px",
    animation: "pulse 2s ease-in-out infinite",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: 80,
    background: COLORS.white,
    borderRadius: 24,
    border: `1px dashed ${COLORS.border}`,
    animation: "fadeInUp 0.5s ease-out",
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    background: COLORS.offWhite,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export default PatientAccessControl;