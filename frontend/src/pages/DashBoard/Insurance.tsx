import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { CreditCard, ShieldCheck, Zap, HeartPulse, CheckSquare, Search, ArrowRight, Globe, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { API_BASE_URL } from "../../config";

const COLORS = {
  navy: "#0A1628",
  navyMid: "#112240",
  teal: "#00C9A7",
  tealLight: "#E0FDF6",
  white: "#FFFFFF",
  offWhite: "#F8FAFC",
  border: "#E2E8F0",
  muted: "#64748B",
  blue: "#3B82F6",
  amber: "#F59E0B"
};

const SCHEMES = [
  {
    id: 1,
    title: "Ayushman Bharat PM-JAY",
    category: "Government",
    description: "World's largest health insurance scheme fully financed by the government. Provides a cover of Rs. 5 lakhs per family per year for secondary and tertiary care hospitalization.",
    features: ["Cashless Access to Health Care", "Covers up to 3 days of pre-hospitalization", "No restriction on family size, age or gender"],
    color: COLORS.teal,
    icon: <ShieldCheck size={28} color={COLORS.teal} />
  },
  {
    id: 2,
    title: "Employee State Insurance (ESIC)",
    category: "Government",
    description: "Self-financing social security and health insurance scheme for Indian workers. Designed to protect employees against sickness, maternity, disablement and death due to employment injury.",
    features: ["Full Medical Care", "Sickness Benefit", "Maternity Benefit"],
    color: COLORS.blue,
    icon: <HeartPulse size={28} color={COLORS.blue} />
  },
  {
    id: 3,
    title: "Central Government Health Scheme (CGHS)",
    category: "Government",
    description: "Provides comprehensive health care facilities for the Central Govt. employees and pensioners and their dependents residing in CGHS covered cities.",
    features: ["OPD Treatment", "Specialist Consultation", "Cashless facility in empanelled hospitals"],
    color: COLORS.amber,
    icon: <CheckSquare size={28} color={COLORS.amber} />
  },
  {
    id: 4,
    title: "Aam Aadmi Bima Yojana (AABY)",
    category: "Government",
    description: "A social security scheme for rural landless household. The premium is equally shared by the Central Government and the State Government.",
    features: ["Life Insurance Cover", "Disability Benefits", "Add-on scholarships for children"],
    color: COLORS.navyMid,
    icon: <ShieldCheck size={28} color={COLORS.navyMid} />
  }
];

const Insurance: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [schemes, setSchemes] = useState<any[]>(SCHEMES);
  const [isScraping, setIsScraping] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      navigate("/login");
      return;
    }
    setUser(JSON.parse(storedUser));
  }, [navigate]);

  if (!user) return null;

  const filteredSchemes = schemes.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const performScrape = async () => {
    setIsScraping(true);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE_URL}/api/schemes/scrape/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map((d: any, i: number) => ({
          id: `scraped-${i}`,
          title: d.title,
          category: d.category || "Web Scraped",
          description: d.description,
          features: d.features || [],
          url: d.url,
          color: [COLORS.teal, COLORS.blue, COLORS.amber, COLORS.navyMid][i % 4],
          icon: <Globe size={28} color={[COLORS.teal, COLORS.blue, COLORS.amber, COLORS.navyMid][i % 4]} />
        }));
        setSchemes([...formatted, ...SCHEMES]);
      }
    } catch (e) {
      console.error(e);
    }
    setIsScraping(false);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: COLORS.offWhite }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }
        .scheme-card {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scheme-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.06);
        }
        .apply-btn {
          transition: all 0.2s ease;
        }
        .apply-btn:hover {
          background: ${COLORS.navy};
          color: white !important;
        }
        .search-input::placeholder { color: #94A3B8; }
      `}</style>
      
      <Sidebar user={user} />
      
      <main style={{ flexGrow: 1, marginLeft: 260, padding: "40px", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ marginBottom: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: COLORS.navy, letterSpacing: "-0.5px", margin: 0 }}>
              Insurance & Schemes
            </h1>
            <p style={{ color: COLORS.muted, fontSize: 15, marginTop: 8 }}>
              Explore and apply for nationwide medical insurance covers
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div style={{
          background: COLORS.white,
          borderRadius: 20,
          padding: 24,
          marginBottom: 32,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: COLORS.tealLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CreditCard size={24} color={COLORS.teal} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy }}>Check Your Eligibility</div>
              <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 4 }}>Automatically scan your profile and ABHA linking to find the best matching schemes.</div>
            </div>
          </div>
          <button 
            onClick={performScrape}
            disabled={isScraping}
            style={{ 
              background: isScraping ? COLORS.border : COLORS.teal, color: isScraping ? COLORS.muted : COLORS.navy, 
              border: "none", padding: "12px 24px", borderRadius: 12, 
              fontSize: 14, fontWeight: 700, cursor: isScraping ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 8
            }}>
            {isScraping ? <><Activity size={16} className="spin" /> Scraping Web...</> : <><Globe size={16} /> Live Scrape Internet</>}
          </button>
        </div>

        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} } .spin { animation: spin 1s linear infinite; }`}</style>

        {/* Search */}
        <div style={{ 
          display: "flex", alignItems: "center", background: "#fff", 
          border: `1px solid ${COLORS.border}`, borderRadius: 14, 
          padding: "12px 16px", marginBottom: 32, width: "100%", maxWidth: 400
        }}>
          <Search size={18} color={COLORS.muted} style={{ marginRight: 12 }} />
          <input 
            type="text" 
            className="search-input"
            placeholder="Search for schemes, benefits, or keywords..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              border: "none", outline: "none", background: "transparent", 
              fontSize: 14, fontWeight: 600, color: COLORS.navy, flex: 1 
            }}
          />
        </div>

        {/* Schemes Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
          {filteredSchemes.map((scheme, idx) => (
            <motion.div 
              key={scheme.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="scheme-card"
              style={{
                background: COLORS.white,
                borderRadius: 20,
                border: `1px solid ${COLORS.border}`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}
            >
              <div style={{ padding: 24, borderBottom: `1px solid ${COLORS.border}`, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ 
                    width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${scheme.color}15` 
                  }}>
                    {scheme.icon}
                  </div>
                  <span style={{ 
                    fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 99, 
                    background: COLORS.offWhite, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.5px" 
                  }}>
                    {scheme.category}
                  </span>
                </div>
                
                <h3 style={{ fontSize: 18, fontWeight: 800, color: COLORS.navy, marginBottom: 10 }}>{scheme.title}</h3>
                <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, marginBottom: 20 }}>
                  {scheme.description}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {scheme.features.map((feature: string, fIdx: number) => (
                    <div key={fIdx} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <CheckSquare size={14} color={scheme.color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.navyMid }}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: COLORS.offWhite, padding: 16, display: "flex", gap: 12 }}>
                <button 
                  className="apply-btn"
                  style={{
                    flex: 1, background: "transparent", color: COLORS.navy,
                    border: `1px solid ${COLORS.border}`, padding: "10px",
                    borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                  }}
                >
                  View Details
                </button>
                <button 
                  onClick={() => {
                    if (scheme.url) {
                      window.open(scheme.url, "_blank");
                    } else {
                      window.open(`https://www.myscheme.gov.in/search?query=${encodeURIComponent(scheme.title)}`, "_blank");
                    }
                  }}
                  style={{
                    flex: 1, background: scheme.color, color: "#fff",
                    border: "none", padding: "10px",
                    borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                  }}
                >
                  Apply <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          ))}

          {filteredSchemes.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: COLORS.muted }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.navy }}>No schemes found</div>
              <div style={{ fontSize: 14 }}>Try adjusting your search criteria</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Insurance;
