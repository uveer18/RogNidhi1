import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, FileText, Calendar, Search, Bell,
  Eye, Download, ChevronDown, ChevronUp, Shield,
  User, Droplets, AlertCircle, Activity, Stethoscope,
  FileImage, ClipboardList, Pill, Syringe, Heart
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
  white: "#FFFFFF",
  offWhite: "#F8FAFC",
  muted: "#64748B",
  border: "#E2E8F0",
  danger: "#EF4444",
  amber: "#F59E0B",
  amberLight: "#FFFBEB",
  purple: "#8B5CF6",
  purpleLight: "#EDE9FE",
  blue: "#3B82F6",
  blueLight: "#EFF6FF",
};

interface PatientInfo {
  id: number;
  name: string;
  email: string;
  blood_group?: string | null;
  dob?: string | null;
  allergies?: string | null;
}

interface DocumentRecord {
  id: number;
  title: string;
  type: string;
  raw_type: string;
  date: string;
  upload_date: string;
  file_url: string;
  ai_summary: string | null;
  extracted_data: any;
}

const TYPE_ICON_MAP: Record<string, { icon: React.ComponentType<any>; bg: string; color: string }> = {
  blood_test:        { icon: Droplets,      bg: "#FEF2F2", color: "#EF4444" },
  pathology:         { icon: Activity,      bg: COLORS.purpleLight, color: COLORS.purple },
  lab_report:        { icon: ClipboardList, bg: COLORS.blueLight, color: COLORS.blue },
  prescription:      { icon: Pill,          bg: "#ECFDF5", color: "#10B981" },
  discharge_summary: { icon: FileText,      bg: COLORS.amberLight, color: COLORS.amber },
  vaccination:       { icon: Syringe,       bg: "#FDF4FF", color: "#A855F7" },
  insurance:         { icon: Shield,        bg: COLORS.tealLight, color: COLORS.teal },
  other:             { icon: FileText,      bg: COLORS.offWhite, color: COLORS.muted },
};

const DoctorPatientRecords: React.FC = () => {
  const navigate = useNavigate();
  const { patientId } = useParams<{ patientId: string }>();
  const user = JSON.parse(localStorage.getItem("user") ?? "{}");
  const token = localStorage.getItem("access") ?? "";

  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Auth guard ──
  useEffect(() => {
    if (!token || user.role !== "doctor") navigate("/login");
  }, [token, user.role, navigate]);

  // ── Fetch data ──
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/access/patient-documents/${patientId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load patient records.");
        return;
      }
      const data = await res.json();
      setPatient(data.patient);
      setDocuments(data.documents ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [patientId, token]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  if (!user.name) return null;

  const filtered = documents.filter(d =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeConfig = (rawType: string) =>
    TYPE_ICON_MAP[rawType] || TYPE_ICON_MAP.other;

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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .bell-breathe { animation: pulse 2.5s ease-in-out infinite; }
        .patient-info-breathe { animation: breathe 3s ease-in-out infinite; }

        .dpr-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: 1px solid ${COLORS.border};
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          color: ${COLORS.muted};
          cursor: pointer;
          transition: all 0.25s ease;
          font-family: inherit;
        }
        .dpr-back-btn:hover {
          background: ${COLORS.white};
          border-color: ${COLORS.teal};
          color: ${COLORS.navy};
        }

        .dpr-doc-card {
          background: ${COLORS.white};
          border: 1px solid ${COLORS.border};
          border-radius: 18px;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeInUp 0.4s ease-out both;
        }
        .dpr-doc-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.07);
          border-color: ${COLORS.teal}40;
        }

        .dpr-view-file-btn {
          background: linear-gradient(135deg, ${COLORS.teal}, #00B894);
          color: ${COLORS.navy};
          border: none;
          padding: 7px 14px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s;
          font-family: inherit;
          box-shadow: 0 2px 8px rgba(0, 201, 167, 0.2);
        }
        .dpr-view-file-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0, 201, 167, 0.3);
        }

        .dpr-expand-btn {
          background: none;
          border: 1px solid ${COLORS.border};
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: ${COLORS.muted};
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s;
          font-family: inherit;
        }
        .dpr-expand-btn:hover {
          background: ${COLORS.offWhite};
          color: ${COLORS.navy};
        }

        .dpr-summary-panel {
          overflow: hidden;
          transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                      padding 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                      opacity 0.3s ease;
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
              placeholder="Search documents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <NotificationDropdown />
          </div>
        </header>

        {/* Page Content */}
        <div style={styles.contentArea}>

          {/* Back Button */}
          <div style={{ marginBottom: 24, animation: "fadeInUp 0.3s ease-out" }}>
            <button className="dpr-back-btn" onClick={() => navigate("/Dashboard/DoctorDashboard")}>
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>
          </div>

          {/* Error State */}
          {error && (
            <div style={{
              background: "#FEF2F2",
              border: "1px solid #FECDD3",
              borderRadius: 16,
              padding: "24px 32px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              animation: "fadeInUp 0.4s ease-out",
            }}>
              <AlertCircle size={24} color={COLORS.danger} />
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.danger }}>
                  Access Denied
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 14, color: "#991B1B" }}>{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div style={{
              textAlign: "center",
              padding: 80,
              animation: "fadeInUp 0.4s ease-out",
            }}>
              <div style={{
                width: 32, height: 32,
                border: `4px solid ${COLORS.border}`,
                borderTopColor: COLORS.teal,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }} />
              <span style={{ color: COLORS.muted, fontWeight: 600, fontSize: 15 }}>
                Loading patient records...
              </span>
            </div>
          )}

          {/* Patient Info Card + Documents */}
          {!loading && !error && patient && (
            <>
              {/* Patient Header */}
              <div className="patient-info-breathe" style={{
                ...styles.patientInfoCard,
                animation: "fadeInUp 0.5s ease-out",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: 18,
                    background: `linear-gradient(135deg, ${COLORS.teal}, #00B894)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: `0 8px 24px ${COLORS.teal}33`,
                  }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: COLORS.navy }}>
                      {patient.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: COLORS.navy, letterSpacing: "-0.5px" }}>
                      {patient.name}
                    </h2>
                    <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 13, color: COLORS.muted }}>
                      <span>{patient.email}</span>
                      {patient.blood_group && (
                        <span style={{
                          background: COLORS.offWhite,
                          padding: "2px 10px",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}>
                          <Droplets size={12} />
                          {patient.blood_group}
                        </span>
                      )}
                      {patient.allergies && (
                        <span style={{
                          background: "#FEF2F2",
                          color: COLORS.danger,
                          padding: "2px 10px",
                          borderRadius: 8,
                          fontWeight: 700,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}>
                          <AlertCircle size={12} />
                          {patient.allergies}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: "flex",
                  gap: 24,
                  alignItems: "center",
                }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.navy }}>{documents.length}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Records
                    </div>
                  </div>
                </div>
              </div>

              {/* Documents Section */}
              <div style={{ marginTop: 32 }}>
                <h3 style={{
                  fontSize: 18, fontWeight: 700, color: COLORS.navy,
                  marginBottom: 20, display: "flex", alignItems: "center", gap: 10,
                }}>
                  <FileText size={18} />
                  Medical Records
                  <span style={{
                    background: COLORS.teal,
                    color: COLORS.navy,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "2px 10px",
                    borderRadius: 10,
                  }}>
                    {filtered.length}
                  </span>
                </h3>

                {filtered.length === 0 ? (
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIconWrap}>
                      <FileText size={40} color={COLORS.border} />
                    </div>
                    <h3 style={{ color: COLORS.navy, fontSize: 17, fontWeight: 700, margin: "16px 0 6px" }}>
                      {searchQuery ? "No matching records" : "No records found"}
                    </h3>
                    <p style={{ color: COLORS.muted, fontSize: 14, margin: 0, maxWidth: 360, lineHeight: 1.6 }}>
                      {searchQuery
                        ? "Try adjusting your search query."
                        : "This patient hasn't uploaded any medical records yet."}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {filtered.map((doc, index) => {
                      const typeConfig = getTypeConfig(doc.raw_type);
                      const TypeIcon = typeConfig.icon;
                      const isExpanded = expandedId === doc.id;

                      return (
                        <div
                          key={doc.id}
                          className="dpr-doc-card"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          {/* Card Header */}
                          <div style={{
                            padding: "20px 24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                              <div style={{
                                width: 46, height: 46, borderRadius: 14,
                                background: typeConfig.bg,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                              }}>
                                <TypeIcon size={20} color={typeConfig.color} />
                              </div>
                              <div>
                                <h4 style={{
                                  margin: 0, fontSize: 15, fontWeight: 700,
                                  color: COLORS.navy, letterSpacing: "-0.2px",
                                }}>
                                  {doc.title}
                                </h4>
                                <div style={{
                                  display: "flex", gap: 12, marginTop: 5,
                                  fontSize: 12, color: COLORS.muted,
                                }}>
                                  <span style={{
                                    background: `${typeConfig.color}12`,
                                    color: typeConfig.color,
                                    padding: "2px 10px",
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    fontSize: 11,
                                  }}>
                                    {doc.type}
                                  </span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <Calendar size={12} />
                                    {doc.date}
                                  </span>
                                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ opacity: 0.5 }}>•</span>
                                    Uploaded: {doc.upload_date ? doc.upload_date.split(',')[0] : "Unknown"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {doc.ai_summary && (
                                <button
                                  className="dpr-expand-btn"
                                  onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                                >
                                  <Stethoscope size={13} />
                                  AI Summary
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              )}
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="dpr-view-file-btn"
                                style={{ textDecoration: "none" }}
                              >
                                <Eye size={13} />
                                View File
                              </a>
                            </div>
                          </div>

                          {/* Expandable AI Summary */}
                          <div
                            className="dpr-summary-panel"
                            style={{
                              maxHeight: isExpanded ? 600 : 0,
                              padding: isExpanded ? "0 24px 20px" : "0 24px",
                              opacity: isExpanded ? 1 : 0,
                            }}
                          >
                            <div style={{
                              background: COLORS.offWhite,
                              borderRadius: 14,
                              padding: "18px 22px",
                              border: `1px solid ${COLORS.border}`,
                            }}>
                              <div style={{
                                display: "flex", alignItems: "center", gap: 8,
                                marginBottom: 12,
                              }}>
                                <Stethoscope size={14} color={COLORS.teal} />
                                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.teal, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  AI Clinical Summary
                                </span>
                              </div>
                              <p style={{
                                margin: 0,
                                fontSize: 14,
                                lineHeight: 1.7,
                                color: COLORS.navy,
                                whiteSpace: "pre-wrap",
                              }}>
                                {doc.ai_summary}
                              </p>

                              {/* Extracted Data */}
                              {doc.extracted_data && Array.isArray(doc.extracted_data) && doc.extracted_data.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                  <div style={{
                                    fontSize: 12, fontWeight: 700, color: COLORS.muted,
                                    textTransform: "uppercase", letterSpacing: "0.5px",
                                    marginBottom: 10,
                                  }}>
                                    Extracted Values
                                  </div>
                                  <div style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                    gap: 8,
                                  }}>
                                    {doc.extracted_data.map((item: any, idx: number) => (
                                      <div key={idx} style={{
                                        background: COLORS.white,
                                        borderRadius: 10,
                                        padding: "10px 14px",
                                        border: `1px solid ${COLORS.border}`,
                                      }}>
                                        <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>
                                          {item.name || item.test_name || Object.keys(item)[0]}
                                        </div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy, marginTop: 2 }}>
                                          {item.value || item.result || Object.values(item)[0]}
                                          {item.unit && <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 4 }}>{item.unit}</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
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
  patientInfoCard: {
    background: COLORS.white,
    borderRadius: 22,
    padding: "28px 32px",
    border: `1px solid ${COLORS.border}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
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
    width: 80,
    height: 80,
    borderRadius: 22,
    background: COLORS.offWhite,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export default DoctorPatientRecords;
