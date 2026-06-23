import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Clock, Share2, TrendingUp, ShieldCheck, CreditCard, LogOut, Link
} from "lucide-react";

const COLORS = {
  navy: "#0A1628",
  navyMid: "#112240",
  teal: "#00C9A7",
};

interface SidebarProps {
  user: { name: string; id?: number; role?: string };
}

const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get role from props or localStorage
  const role = user.role || JSON.parse(localStorage.getItem("user") || "{}").role;

  // Paths here must match the "path" prop in App.tsx exactly
  const NAV_ITEMS = [
    { 
      path: role === "doctor" ? "/DashBoard/DoctorDashboard" : "/DashBoard/PatientDashboard", 
      label: "Timeline", 
      icon: Clock 
    },
    { path: "/DashBoard/HealthTrends", label: "Health Trends", icon: TrendingUp },
    { 
      path: "/DashBoard/RogNidhiHistory", 
      label: "RogNidhi History", 
      icon: Share2 
    },
    { 
      path: role === "doctor" ? "/doctor-access-control" : "/access-control", 
      label: "Access Control", 
      icon: ShieldCheck 
    },
    ...(role !== "doctor" ? [
      { path: "/DashBoard/LinkABHA", label: "Link ABHA", icon: Link },
      { path: "/DashBoard/Insurance", label: "Insurance", icon: CreditCard },
    ] : [])
  ];

  return (
    <aside style={{
      width: 260,
      background: `linear-gradient(180deg, ${COLORS.navy} 0%, ${COLORS.navyMid} 100%)`,
      padding: "36px 18px",
      display: "flex",
      flexDirection: "column",
      position: "fixed",
      height: "100vh",
      color: "#fff",
      zIndex: 100,
    }}>
      <style>{`
        @keyframes sb-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        .sb-logo-breathe { animation: sb-breathe 3s ease-in-out infinite; }
        .sb-nav-item {
          transition: all 0.18s ease;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          border-radius: 10px;
          color: rgba(255,255,255,0.5);
          font-weight: 500;
          font-size: 14px;
          margin-bottom: 2px;
        }
        .sb-nav-item:hover { background: rgba(255,255,255,0.09); color: #fff; }
        .sb-nav-item.active {
          background: ${COLORS.teal};
          color: ${COLORS.navy} !important;
          font-weight: 700;
          box-shadow: 0 6px 16px rgba(0,201,167,0.22);
        }

        .sb-logout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 11px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid transparent;
          color: rgba(255,255,255,0.6);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        }
        .sb-logout-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #FCA5A5;
        }
        .sb-logout-btn .sb-logout-icon {
          display: inline-flex;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sb-logout-btn:hover .sb-logout-icon {
          transform: translateX(-3px);
        }
      `}</style>

      {/* Logo Section */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 44, paddingLeft: 8 }}>
        <div className="sb-logo-breathe" style={{ width: 36, height: 36, background: "rgba(255,255,255,0.08)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
          <ShieldCheck size={19} color={COLORS.teal} />
        </div>
        <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.5px" }}>RogNidhi</span>
      </div>

      {/* Navigation */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 3, flexGrow: 1 }}>
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const isActive = path && location.pathname === path;
          return (
            <div
              key={label}
              className={`sb-nav-item ${isActive ? "active" : ""}`}
              onClick={() => path && navigate(path)}
              style={!path ? { opacity: 0.4, cursor: "default" } : {}}
            >
              <Icon size={16} />
              {label}
            </div>
          );
        })}
      </nav>

      {/* User Card & Logout */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(255,255,255,0.05)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: COLORS.teal, color: COLORS.navy, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
            {user.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{role?.toUpperCase()} • #RN-{user.id ?? "001"}</div>
          </div>
        </div>
        <button
          className="sb-logout-btn"
          onClick={() => { localStorage.clear(); navigate("/"); }}
        >
          <span className="sb-logout-icon"><LogOut size={16} /></span> Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;