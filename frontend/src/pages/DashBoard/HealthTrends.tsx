import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { API_BASE_URL } from "../../config";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { TrendingUp, BarChart2, Activity, Zap, GripVertical, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = {
  navy: "#0A1628",
  navyMid: "#112240",
  teal: "#00C9A7",
  tealLight: "#E0FDF6",
  white: "#FFFFFF",
  offWhite: "#F8FAFC",
  border: "#E2E8F0",
  muted: "#64748B",
  red: "#EF4444",
  amber: "#F59E0B",
  green: "#10B981",
};

const CHART_PALETTE = [
  "#00C9A7", "#6366F1", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#14B8A6", "#F97316", "#3B82F6", "#84CC16",
];

// ── Status → color ────────────────────────────────────────────
const statusColor = (status: string) => {
  const s = (status || "").toUpperCase();
  if (s === "HIGH" || s === "CRITICAL") return COLORS.red;
  if (s.includes("LOW")) return COLORS.amber;
  if (s === "NORMAL" || s === "OPTIMAL") return COLORS.green;
  return COLORS.muted;
};

// ── Parse numeric value from string ──────────────────────────
const parseNum = (v: any): number | null => {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

// ── Flatten a single doc's tests into chart-friendly rows ────
interface TestRow {
  name: string;
  value: number;
  unit: string;
  status: string;
  date: string;
  docTitle: string;
  refLow: number | null;
  refHigh: number | null;
}

function parseRef(ref: string): [number | null, number | null] {
  if (!ref) return [null, null];
  // "12.0 - 16.0" or "12-16"
  const dash = ref.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (dash) return [parseFloat(dash[1]), parseFloat(dash[2])];
  // "< 200" or "> 60"
  const lt = ref.match(/<\s*([\d.]+)/);
  if (lt) return [null, parseFloat(lt[1])];
  const gt = ref.match(/>\s*([\d.]+)/);
  if (gt) return [parseFloat(gt[1]), null];
  return [null, null];
}

function flattenDocs(docs: any[]): TestRow[] {
  const rows: TestRow[] = [];
  for (const doc of docs) {
    const date = doc.date ?? "Unknown";
    for (const t of doc.tests ?? []) {
      const val = parseNum(t.value);
      if (val === null) continue;
      const [refLow, refHigh] = parseRef(t.reference_range ?? "");
      rows.push({
        name: t.test_name ?? "Unknown",
        value: val,
        unit: t.unit ?? "",
        status: t.status ?? "NORMAL",
        date,
        docTitle: doc.title,
        refLow,
        refHigh,
      });
    }
  }
  return rows;
}

// ── Group rows by test name ───────────────────────────────────
function groupByTest(rows: TestRow[]): Record<string, TestRow[]> {
  const map: Record<string, TestRow[]> = {};
  for (const r of rows) {
    if (!map[r.name]) map[r.name] = [];
    map[r.name].push(r);
  }
  return map;
}

// ── Draggable card wrapper ────────────────────────────────────
interface DraggableCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const DraggableCard: React.FC<DraggableCardProps> = ({
  title, subtitle, icon, children, defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".chart-body")) return;
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      setPos({
        x: dragStart.current.px + e.clientX - dragStart.current.mx,
        y: dragStart.current.py + e.clientY - dragStart.current.my,
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: "#fff",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        boxShadow: dragging
          ? "0 24px 48px rgba(10,22,40,0.18)"
          : "0 4px 20px rgba(0,0,0,0.04)",
        overflow: "hidden",
        position: "relative",
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        zIndex: dragging ? 1000 : 1,
        cursor: dragging ? "grabbing" : "default",
        userSelect: "none",
        marginBottom: 24,
      }}
    >
      {/* Card Header — drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 20px", cursor: "grab",
          borderBottom: expanded ? `1px solid ${COLORS.border}` : "none",
          background: COLORS.offWhite,
        }}
      >
        <GripVertical size={16} color={COLORS.muted} style={{ flexShrink: 0 }} />
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: COLORS.tealLight,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.navy }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, padding: 4 }}
        >
          {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* Card Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            className="chart-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ padding: "20px", overflow: "hidden" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ── Custom Tooltip ────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: COLORS.navy, color: "#fff", padding: "10px 16px",
      borderRadius: 12, fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || COLORS.teal, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong> {p.payload?.unit || ""}
        </div>
      ))}
    </div>
  );
};

// ── Empty state ───────────────────────────────────────────────
const EmptyState = () => (
  <div style={{
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "80px 40px", gap: 16,
    background: "#fff", borderRadius: 20, border: `2px dashed ${COLORS.border}`,
  }}>
    <BarChart2 size={48} color={COLORS.border} />
    <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy }}>No data to chart yet</div>
    <div style={{ fontSize: 14, color: COLORS.muted, textAlign: "center", maxWidth: 320 }}>
      Upload your medical reports — lab results, blood tests, and more — and your health trends will appear here.
    </div>
  </div>
);

// ── STATUS SUMMARY PILL ───────────────────────────────────────
const StatusPill = ({ status }: { status: string }) => {
  const color = statusColor(status);
  const bg = color + "18";
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: "3px 10px",
      borderRadius: 99, color, background: bg,
      textTransform: "uppercase", letterSpacing: "0.4px",
    }}>
      {status}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
const HealthTrends: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("All");

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) { navigate("/login"); return; }
    setUser(JSON.parse(stored));
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE_URL}/api/records/chart-data/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setDocs(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  };

  // ── Derived data ──────────────────────────────────────────
  const allRows = useMemo(() => flattenDocs(docs), [docs]);
  const byTest = useMemo(() => groupByTest(allRows), [allRows]);
  const testNames = useMemo(() => Object.keys(byTest).sort(), [byTest]);

  // unique categories for filter
  const docTypes = useMemo(() => {
    const types = new Set(docs.map(d => (d.type || "other").toUpperCase()));
    return ["All", ...Array.from(types)];
  }, [docs]);

  const filteredDocs = useMemo(() =>
    activeFilter === "All" ? docs : docs.filter(d => d.type?.toUpperCase() === activeFilter),
    [docs, activeFilter]);

  const filteredRows = useMemo(() => flattenDocs(filteredDocs), [filteredDocs]);
  const filteredByTest = useMemo(() => groupByTest(filteredRows), [filteredRows]);

  // ── Status distribution for Pie-equivalent bar ────────────
  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = { NORMAL: 0, HIGH: 0, LOW: 0, OTHER: 0 };
    for (const r of filteredRows) {
      const s = (r.status || "").toUpperCase();
      if (s === "NORMAL" || s === "OPTIMAL") counts.NORMAL++;
      else if (s === "HIGH" || s === "BORDERLINE HIGH" || s === "CRITICAL") counts.HIGH++;
      else if (s.includes("LOW") || s.includes("DEFICIENT")) counts.LOW++;
      else counts.OTHER++;
    }
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filteredRows]);

  // ── Tests that have multiple readings (for trend lines) ───
  const multiReadingTests = useMemo(() =>
    Object.entries(filteredByTest)
      .filter(([, rows]) => rows.length > 1)
      .sort(([, a], [, b]) => b.length - a.length),
    [filteredByTest]);

  // ── All tests as scatter data (value vs refRange) ─────────
  const scatterData = useMemo(() =>
    filteredRows.map(r => ({
      name: r.name,
      value: r.value,
      refHigh: r.refHigh,
      refLow: r.refLow,
      status: r.status,
      docTitle: r.docTitle,
    })).slice(0, 40),
    [filteredRows]);

  // ── Latest reading per test for health snapshot bar chart ─
  const latestPerTest = useMemo(() => {
    return Object.entries(filteredByTest).map(([name, rows]) => {
      const sorted = [...rows].sort((a, b) => (b.date > a.date ? 1 : -1));
      const latest = sorted[0];
      return {
        name: name.length > 20 ? name.slice(0, 18) + "…" : name,
        fullName: name,
        value: latest.value,
        unit: latest.unit,
        status: latest.status,
        fill: statusColor(latest.status),
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredByTest]);

  // ── Radar data: normalised score per test (0-100) ─────────
  const radarData = useMemo(() => {
    return Object.entries(filteredByTest)
      .slice(0, 10)
      .map(([name, rows]) => {
        const latest = [...rows].sort((a, b) => (b.date > a.date ? 1 : -1))[0];
        let score = 50; // neutral
        if (latest.refHigh !== null && latest.refLow !== null) {
          const range = latest.refHigh - latest.refLow;
          if (range > 0) {
            score = Math.min(100, Math.max(0,
              100 - Math.abs(latest.value - (latest.refLow + range / 2)) / range * 100
            ));
          }
        } else if (latest.refHigh !== null) {
          score = latest.value <= latest.refHigh ? 85 : 25;
        } else if (latest.refLow !== null) {
          score = latest.value >= latest.refLow ? 85 : 25;
        }
        return {
          subject: name.length > 15 ? name.slice(0, 13) + "…" : name,
          score: Math.round(score),
          fullName: name,
        };
      });
  }, [filteredByTest]);

  if (!user) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: COLORS.offWhite }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }
        .filter-pill { transition: all 0.18s ease; cursor: pointer; padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 700; letter-spacing: 0.4px; }
        .filter-pill:hover { background: ${COLORS.teal}22; }
        .filter-pill.active { background: ${COLORS.teal}; color: ${COLORS.navy}; }
        .filter-pill:not(.active) { background: #fff; color: ${COLORS.muted}; border: 1px solid ${COLORS.border}; }
      `}</style>

      <Sidebar user={user} />

      <main style={{ flexGrow: 1, marginLeft: 260, padding: "40px", minWidth: 0 }}>
        {/* ── Page header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: COLORS.navy, margin: 0, letterSpacing: "-0.5px" }}>
              Health Trends
            </h1>
            <p style={{ color: COLORS.muted, marginTop: 6, fontSize: 14 }}>
              Interactive visualisation of your medical data across {docs.length} document{docs.length !== 1 ? "s" : ""} and {allRows.length} data points
            </p>
          </div>
          <button
            onClick={fetchData}
            style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.navy, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>

        {/* ── Filter Pills ── */}
        {docTypes.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            {docTypes.map(t => (
              <div
                key={t}
                className={`filter-pill ${activeFilter === t ? "active" : ""}`}
                onClick={() => setActiveFilter(t)}
              >
                {t}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
            <div style={{ textAlign: "center", color: COLORS.muted }}>
              <Activity size={36} style={{ animation: "spin 1s linear infinite", marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600 }}>Loading chart data…</div>
              <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
            </div>
          </div>
        ) : allRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, alignItems: "start" }}>

            {/* ── 1. Health Snapshot — latest value per test (Bar) ── */}
            <div style={{ gridColumn: "1 / -1" }}>
              <DraggableCard
                title="Health Snapshot"
                subtitle="Latest reading for each biomarker — colour-coded by status"
                icon={<BarChart2 size={15} color={COLORS.teal} />}
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={latestPerTest} margin={{ top: 8, right: 20, left: 0, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: COLORS.muted, fontWeight: 600 }}
                      angle={-40}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: COLORS.navy, color: "#fff", padding: "12px 16px", borderRadius: 12, fontSize: 13 }}>
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>{d.fullName}</div>
                            <div>Value: <strong>{d.value} {d.unit}</strong></div>
                            <div style={{ marginTop: 4 }}><StatusPill status={d.status} /></div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {latestPerTest.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Legend pills */}
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "Normal / Optimal", color: COLORS.green },
                    { label: "High / Critical", color: COLORS.red },
                    { label: "Low / Deficient", color: COLORS.amber },
                    { label: "Other", color: COLORS.muted },
                  ].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.muted }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </DraggableCard>
            </div>

            {/* ── 2. Trend Lines (for tests with multiple readings) ── */}
            {multiReadingTests.length > 0 && (
              <div style={{ gridColumn: "1 / -1" }}>
                <DraggableCard
                  title="Biomarker Trends Over Time"
                  subtitle={`${multiReadingTests.length} test${multiReadingTests.length > 1 ? "s" : ""} with multiple readings`}
                  icon={<TrendingUp size={15} color={COLORS.teal} />}
                >
                  {multiReadingTests.map(([testName, rows], idx) => {
                    const sorted = [...rows].sort((a, b) => (a.date > b.date ? 1 : -1));
                    const color = CHART_PALETTE[idx % CHART_PALETTE.length];
                    const refLow = sorted[0].refLow;
                    const refHigh = sorted[0].refHigh;
                    return (
                      <div key={testName} style={{ marginBottom: 28 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                          <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.navy }}>{testName}</span>
                          <span style={{ fontSize: 11, color: COLORS.muted }}>({sorted[0].unit})</span>
                          <StatusPill status={sorted[sorted.length - 1].status} />
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={sorted} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.muted }} />
                            <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} domain={["auto", "auto"]} />
                            <Tooltip content={<CustomTooltip />} />
                            {refHigh !== null && (
                              <ReferenceLine y={refHigh} stroke={COLORS.red} strokeDasharray="4 3"
                                label={{ value: `Max ${refHigh}`, fill: COLORS.red, fontSize: 10 }} />
                            )}
                            {refLow !== null && (
                              <ReferenceLine y={refLow} stroke={COLORS.amber} strokeDasharray="4 3"
                                label={{ value: `Min ${refLow}`, fill: COLORS.amber, fontSize: 10 }} />
                            )}
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke={color}
                              strokeWidth={2.5}
                              dot={{ fill: color, strokeWidth: 2, r: 5 }}
                              activeDot={{ r: 7 }}
                              name={testName}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })}
                </DraggableCard>
              </div>
            )}

            {/* ── 3. Status Distribution (Horizontal bar chart) ── */}
            <DraggableCard
              title="Status Distribution"
              subtitle="How many results fall in each category"
              icon={<Activity size={15} color={COLORS.teal} />}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={statusSummary}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.muted }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: COLORS.navy, fontWeight: 700 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Count">
                    {statusSummary.map((entry, idx) => (
                      <Cell key={idx} fill={statusColor(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </DraggableCard>

            {/* ── 4. Radar Chart (health balance across top tests) ── */}
            {radarData.length >= 3 && (
              <DraggableCard
                title="Health Balance Radar"
                subtitle="Normalised score (100 = optimal) for latest readings"
                icon={<Zap size={15} color={COLORS.teal} />}
              >
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                    {/* @ts-ignore - Recharts types conflict with React 19 */}
                    <PolarGrid stroke={COLORS.border} />
                    {/* @ts-ignore */}
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fontSize: 10, fill: COLORS.navy, fontWeight: 600 }}
                    />
                    {/* @ts-ignore */}
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    {/* @ts-ignore */}
                    <Radar
                      name="Score"
                      dataKey="score"
                      stroke={COLORS.teal}
                      fill={COLORS.teal}
                      fillOpacity={0.25}
                      dot={{ fill: COLORS.teal, r: 4 }}
                    />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: COLORS.navy, padding: "10px 14px", borderRadius: 10, fontSize: 12, color: "#fff" }}>
                          <div style={{ fontWeight: 800 }}>{d.fullName}</div>
                          <div style={{ color: COLORS.teal }}>Score: {d.score}/100</div>
                        </div>
                      );
                    }} />
                  </RadarChart>
                </ResponsiveContainer>
              </DraggableCard>
            )}

            {/* ── 5. All Tests Scatter (value vs reference max) ── */}
            {scatterData.length > 0 && (
              <div style={{ gridColumn: scatterData.length > 0 && radarData.length < 3 ? "1 / -1" : undefined }}>
                <DraggableCard
                  title="Value vs. Reference Range"
                  subtitle="Each dot is one test reading. Above the diagonal = HIGH, below = LOW"
                  icon={<TrendingUp size={15} color={COLORS.teal} />}
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                      <XAxis
                        dataKey="refHigh"
                        name="Reference Max"
                        tick={{ fontSize: 10, fill: COLORS.muted }}
                        label={{ value: "Reference Max", position: "insideBottom", offset: -2, fontSize: 11, fill: COLORS.muted }}
                      />
                      <YAxis
                        dataKey="value"
                        name="Actual Value"
                        tick={{ fontSize: 10, fill: COLORS.muted }}
                        label={{ value: "Actual Value", angle: -90, position: "insideLeft", fontSize: 11, fill: COLORS.muted }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div style={{ background: COLORS.navy, padding: "10px 14px", borderRadius: 10, fontSize: 12, color: "#fff" }}>
                              <div style={{ fontWeight: 800, marginBottom: 4 }}>{d.name}</div>
                              <div>Value: <strong>{d.value}</strong></div>
                              {d.refHigh !== null && <div>Ref max: {d.refHigh}</div>}
                              <div style={{ marginTop: 4 }}><StatusPill status={d.status} /></div>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        name="Tests"
                        data={scatterData.filter(d => d.refHigh !== null)}
                      >
                        {scatterData.filter(d => d.refHigh !== null).map((entry, idx) => (
                          <Cell key={idx} fill={statusColor(entry.status)} fillOpacity={0.8} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </DraggableCard>
              </div>
            )}

            {/* ── 6. Data Table – all readings ── */}
            <div style={{ gridColumn: "1 / -1" }}>
              <DraggableCard
                title="All Test Readings"
                subtitle={`${filteredRows.length} data points across ${filteredDocs.length} documents`}
                icon={<BarChart2 size={15} color={COLORS.teal} />}
                defaultExpanded={false}
              >
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: COLORS.offWhite }}>
                        {["Test", "Value", "Unit", "Ref Range", "Status", "Date", "Document"].map(col => (
                          <th key={col} style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, color: COLORS.navy, fontSize: 12, borderBottom: `2px solid ${COLORS.border}` }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}`, background: idx % 2 === 0 ? "#fff" : COLORS.offWhite }}>
                          <td style={{ padding: "10px 14px", fontWeight: 600, color: COLORS.navy }}>{r.name}</td>
                          <td style={{ padding: "10px 14px", fontWeight: 700, color: statusColor(r.status) }}>{r.value}</td>
                          <td style={{ padding: "10px 14px", color: COLORS.muted }}>{r.unit}</td>
                          <td style={{ padding: "10px 14px", color: COLORS.muted }}>
                            {r.refLow !== null && r.refHigh !== null ? `${r.refLow} – ${r.refHigh}` :
                              r.refHigh !== null ? `< ${r.refHigh}` :
                              r.refLow !== null ? `> ${r.refLow}` : "—"}
                          </td>
                          <td style={{ padding: "10px 14px" }}><StatusPill status={r.status} /></td>
                          <td style={{ padding: "10px 14px", color: COLORS.muted }}>{r.date}</td>
                          <td style={{ padding: "10px 14px", color: COLORS.muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.docTitle}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DraggableCard>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default HealthTrends;