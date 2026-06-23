import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Send, Loader2, Bot, User as UserIcon,
  Trash2, Edit2, Plus, MessageSquare, Paperclip, X, CheckCircle2, AlertCircle, Sparkles,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import NotificationDropdown from "../../components/NotificationDropdown";
import { API_BASE_URL } from "../../config";

const COLORS = {
  navy:        "#0A1628",
  sessionBg:   "#182D52",        // higher contrast mid-tone
  sessionText: "rgba(255,255,255,0.85)",
  teal:        "#00C9A7",
  white:       "#FFFFFF",
  offWhite:    "#F8FAFC",
  muted:       "#64748B",
  border:      "#E2E8F0",
  tealLight:   "#E0FDF6",
};

const ease = [0.16, 1, 0.3, 1] as const;

interface Message {
  id: number;
  sender: "user" | "ai";
  text: string;
  fileUrl?: string;
  fileName?: string;
  eval_metrics?: {
    context_relevance?: number;
    faithfulness?: number;
    answer_relevance?: number;
    overall_accuracy?: number;
  };
}

interface ChatSession {
  id: number | "new";
  title: string;
  created_at: string;
}

interface UploadStatus {
  type: "success" | "error";
  msg: string;
}

const RogNidhiHistory: React.FC = () => {
  const navigate = useNavigate();
  const [user,            setUser]            = useState<any>(null);
  const [sessions,        setSessions]        = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | "new" | null>(null);
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [inputValue,      setInputValue]      = useState("");
  const [isLoading,       setIsLoading]       = useState(false);

  // rename
  const [editingId,    setEditingId]    = useState<number | "new" | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // file upload
  const [uploadStatus,  setUploadStatus]  = useState<UploadStatus | null>(null);
  const [isUploading,   setIsUploading]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const clickTimer      = useRef<ReturnType<typeof setTimeout> | null>(null); // debounce single vs double click

  /* ─── init ─── */
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) { setUser(JSON.parse(stored)); fetchSessions(); }
    else navigate("/login");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ─── sessions ─── */
  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: ChatSession[] = await res.json();
        setSessions(data);
        if (data.length > 0) loadMessages(data[0].id);
        else createNewSession();
      }
    } catch (e) { console.error(e); }
  };

  const createNewSession = useCallback(() => {
    setSessions(prev => {
      if (prev.some(s => s.id === "new")) return prev;
      return [{ id: "new", title: "New Chat", created_at: new Date().toISOString() }, ...prev];
    });
    setActiveSessionId("new");
    setMessages([{ id: Date.now(), sender: "ai", text: "Hello! I'm RogNidhi. Ask me anything about your health records." }]);
  }, []);

  const loadMessages = async (sessionId: number | "new") => {
    if (sessionId === "new") {
      setActiveSessionId("new");
      setMessages([{ id: Date.now(), sender: "ai", text: "Hello! I'm RogNidhi. Ask me anything about your health records." }]);
      return;
    }
    setActiveSessionId(sessionId);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${sessionId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(
          data.messages?.length > 0
            ? data.messages
            : [{ id: Date.now(), sender: "ai", text: "Hello! I'm RogNidhi. Ask me anything about your health records." }]
        );
      }
    } catch (e) { console.error(e); }
  };

  /* ─── send message ─── */
  const handleSend = async () => {
    if (!inputValue.trim() || !activeSessionId) return;
    const newMsg: Message = { id: Date.now(), sender: "user", text: inputValue };
    setMessages(prev => [...prev, newMsg]);
    setInputValue("");
    setIsLoading(true);
    let targetId = activeSessionId;
    const token = localStorage.getItem("access");
    try {
      if (targetId === "new") {
        const res = await fetch(`${API_BASE_URL}/api/chat/sessions/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: newMsg.text.slice(0, 32) + "…" }),
        });
        if (res.ok) {
          const data = await res.json();
          targetId = data.id;
          setActiveSessionId(targetId);
          setSessions(prev => [data, ...prev.filter(s => s.id !== "new")]);
        }
      }
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${targetId}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: newMsg.text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.messages) setMessages(data.messages);
      } else {
        setMessages(prev => [...prev, { id: Date.now(), sender: "ai", text: "Something went wrong. Please try again." }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now(), sender: "ai", text: "Network error. Please check your connection." }]);
    } finally {
      setIsLoading(false);
    }
  };

  /* ─── file upload ─── */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.split(".")[0]);
    formData.append("document_type", "other");

    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE_URL}/api/documents/upload/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        setUploadStatus({ type: "success", msg: `"${file.name}" uploaded — AI will now use it as context.` });
        // Add a system-style message in the chat
        setMessages(prev => [...prev, {
          id: Date.now(), sender: "ai",
          text: `📎 I've received **${file.name}**. I'll factor this document into my answers. Feel free to ask!`,
          fileName: file.name,
        }]);
      } else {
        const err = await res.json();
        setUploadStatus({ type: "error", msg: err.file?.[0] ?? "Upload failed." });
      }
    } catch {
      setUploadStatus({ type: "error", msg: "Network error during upload." });
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadStatus(null), 5000);
    }
  };

  /* ─── delete / clear ─── */
  const handleDelete = async (id: number | "new", e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === "new") {
      const rest = sessions.filter(s => s.id !== "new");
      setSessions(rest);
      if (activeSessionId === "new") {
        if (rest.length > 0) loadMessages(rest[0].id);
        else { setMessages([]); setActiveSessionId(null); }
      }
      return;
    }
    if (!window.confirm("Delete this chat session?")) return;
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${id}/`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const rest = sessions.filter(s => s.id !== id);
        setSessions(rest);
        if (activeSessionId === id) {
          if (rest.length > 0) loadMessages(rest[0].id);
          else { setMessages([]); setActiveSessionId(null); }
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Delete all chat history?")) return;
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { setSessions([]); setMessages([]); setActiveSessionId(null); }
    } catch (e) { console.error(e); }
  };

  /* ─── rename ─── */
  const startRename = (id: number | "new", title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (id === "new") return;
    setEditingId(id);
    setEditingTitle(title);
  };

  const submitRename = async (id: number | "new") => {
    if (id === "new" || !editingTitle.trim()) { setEditingId(null); return; }
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API_BASE_URL}/api/chat/sessions/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editingTitle }),
      });
      if (res.ok) setSessions(prev => prev.map(s => s.id === id ? { ...s, title: editingTitle } : s));
    } catch (e) { console.error(e); }
    setEditingId(null);
  };

  /* ─── click/double-click disambiguation on session item ─── */
  // Single click → load messages (after 200ms delay so double-click can cancel it)
  // Double click → start rename
  const handleSessionClick = (s: ChatSession) => {
    if (editingId === s.id) return;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      loadMessages(s.id);
    }, 220);
  };

  const handleSessionDoubleClick = (s: ChatSession, e: React.MouseEvent) => {
    e.preventDefault();
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    startRename(s.id, s.title);
  };

  if (!user) return null;

  const activeTitle = sessions.find(s => s.id === activeSessionId)?.title ?? "New Chat";

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: COLORS.offWhite }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; box-sizing: border-box; }

        .animate-spin { animation: _spin 1s linear infinite; }
        @keyframes _spin { to { transform: rotate(360deg); } }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.85; }
        }
        .bot-icon-breathe { animation: breathe 3s ease-in-out infinite; }
        .new-chat-pulse { animation: pulse 2.5s ease-in-out infinite; }

        .sess-item { transition: background 0.15s ease; cursor: pointer; border-radius: 8px; padding: 11px 13px; display: flex; align-items: center; gap: 10px; user-select: none; }
        .sess-item:hover { background: rgba(255,255,255,0.1); }
        .sess-item.active { background: rgba(0,201,167,0.22); outline: 1px solid rgba(0,201,167,0.4); }
        .pill-actions { opacity: 0; transition: opacity 0.15s; display: flex; gap: 2px; }
        .sess-item:hover .pill-actions { opacity: 1; }

        .sess-btn { background: none; border: none; cursor: pointer; padding: 4px 5px; border-radius: 5px; color: rgba(255,255,255,0.5); transition: all 0.15s; display: flex; align-items: center; }
        .sess-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
        .sess-btn.danger:hover { background: rgba(239,68,68,0.2); color: #FCA5A5; }

        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
        .sess-scroll::-webkit-scrollbar { width: 3px; }
        .sess-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }

        .send-btn { transition: background 0.18s ease, box-shadow 0.18s ease; }
        .file-btn { transition: color 0.15s, background 0.15s; border-radius: 7px; padding: 6px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; }
        .file-btn:hover { background: ${COLORS.tealLight}; color: ${COLORS.teal}; }
      `}</style>

      {/* ─── LEFT NAV SIDEBAR ─── */}
      <Sidebar user={user} />

      {/* ─── SESSIONS SIDEBAR ─── */}
      <div style={{
        position: "fixed", left: 260, top: 0,
        width: 272, height: "100vh",
        background: COLORS.sessionBg,
        borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
        zIndex: 90,
      }}>
        {/* Header */}
        <div style={{ padding: "26px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Conversations
            </span>
            <div style={{ display: "flex", gap: 7 }}>
              <button
                onClick={handleClearAll}
                title="Clear all"
                style={{ background: "rgba(239,68,68,0.14)", color: "#FCA5A5", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em" }}
              >
                Clear
              </button>
              <button
                onClick={createNewSession}
                title="New chat"
                style={{ background: COLORS.teal, color: COLORS.navy, border: "none", borderRadius: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", borderRadius: 7, padding: "7px 11px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Search size={13} color="rgba(255,255,255,0.4)" />
            <input type="text" placeholder="Search…" style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "#fff", width: "100%" }} />
          </div>
        </div>

        {/* List */}
        <div className="sess-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          <AnimatePresence>
            {sessions.map(s => (
              <motion.div
                key={String(s.id)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.16, ease }}
                className={`sess-item${activeSessionId === s.id ? " active" : ""}`}
                onClick={() => handleSessionClick(s)}
                onDoubleClick={e => handleSessionDoubleClick(s, e)}
              >
                <div style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(0,201,167,0.13)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MessageSquare size={13} color={COLORS.teal} />
                </div>

                <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={e => setEditingTitle(e.target.value)}
                      onBlur={() => submitRename(s.id)}
                      onKeyDown={e => {
                        e.stopPropagation();
                        if (e.key === "Enter") submitRename(s.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{ width: "100%", background: "rgba(255,255,255,0.1)", border: `1px solid ${COLORS.teal}`, borderRadius: 5, padding: "3px 7px", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", fontFamily: "inherit" }}
                    />
                  ) : (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.sessionText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                        {new Date(s.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                    </>
                  )}
                </div>

                {editingId !== s.id && (
                  <div className="pill-actions">
                    <button className="sess-btn" title="Rename" onClick={e => startRename(s.id, s.title, e)}><Edit2 size={12} /></button>
                    <button className="sess-btn danger" title="Delete" onClick={e => handleDelete(s.id, e)}><Trash2 size={12} /></button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {sessions.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "rgba(255,255,255,0.25)" }}>
              <MessageSquare size={26} style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13, margin: 0 }}>No sessions yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── MAIN CHAT ─── */}
      <main style={{ flexGrow: 1, marginLeft: 532, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

        {/* Header */}
        <header style={{
          height: 68, padding: "0 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          backgroundColor: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="bot-icon-breathe" style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.tealLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={18} color={COLORS.teal} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.navy }}>RogNidhi AI</div>
              <div style={{ fontSize: 11, color: COLORS.muted }}>{activeTitle}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <NotificationDropdown />
          </div>
        </header>

        {/* Upload toast */}
        <AnimatePresence>
          {uploadStatus && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              style={{
                position: "absolute", top: 80, right: 32, zIndex: 200,
                background: uploadStatus.type === "success" ? "#ECFDF5" : "#FEF2F2",
                border: `1px solid ${uploadStatus.type === "success" ? "#10B981" : "#EF4444"}`,
                padding: "10px 18px", borderRadius: 8, display: "flex", alignItems: "center", gap: 10,
                boxShadow: "0 6px 20px rgba(0,0,0,0.08)", maxWidth: 380,
              }}
            >
              {uploadStatus.type === "success"
                ? <CheckCircle2 size={16} color="#10B981" />
                : <AlertCircle size={16} color="#EF4444" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: uploadStatus.type === "success" ? "#065F46" : "#991B1B" }}>
                {uploadStatus.msg}
              </span>
              <X size={14} color={COLORS.muted} style={{ cursor: "pointer", marginLeft: "auto" }} onClick={() => setUploadStatus(null)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat area */}
        {activeSessionId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Messages */}
            <div className="chat-scroll" style={{ flex: 1, padding: "28px 36px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease }}
                    style={{ display: "flex", gap: 11, flexDirection: msg.sender === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: msg.sender === "user" ? COLORS.navy : COLORS.tealLight, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 4 }}>
                      {msg.sender === "user" ? <UserIcon size={13} color="#fff" /> : <Bot size={13} color={COLORS.teal} />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", maxWidth: "70%", alignItems: msg.sender === "user" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        padding: "12px 16px", fontSize: 14, lineHeight: 1.65,
                        borderRadius: msg.sender === "user" ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
                        background: msg.sender === "user" ? COLORS.navy : COLORS.white,
                        color: msg.sender === "user" ? "#fff" : COLORS.navy,
                        border: msg.sender === "user" ? "none" : `1px solid ${COLORS.border}`,
                        boxShadow: msg.sender === "user" ? "0 3px 10px rgba(10,22,40,0.13)" : "0 2px 6px rgba(0,0,0,0.03)",
                      }}>
                        {msg.text.split("\n").map((line, i, arr) => (
                          <React.Fragment key={i}>{line}{i < arr.length - 1 && <br />}</React.Fragment>
                        ))}
                      </div>

                      {msg.sender === 'ai' && msg.eval_metrics && (
                        <div style={{
                          marginTop: 8,
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: 'rgba(0, 201, 167, 0.04)',
                          border: '1px dashed rgba(0, 201, 167, 0.25)',
                          fontSize: '11px',
                          color: COLORS.navy,
                          width: '100%',
                          minWidth: 260,
                          boxSizing: 'border-box',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                              <Sparkles size={12} color={COLORS.teal} />
                              Retrieval & Generation Accuracy
                            </span>
                            <span style={{
                              fontWeight: 800,
                              fontSize: 11,
                              color: msg.eval_metrics.overall_accuracy && msg.eval_metrics.overall_accuracy >= 80 ? COLORS.teal : '#D97706',
                              background: msg.eval_metrics.overall_accuracy && msg.eval_metrics.overall_accuracy >= 80 ? 'rgba(0, 201, 167, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                              padding: '2px 7px',
                              borderRadius: 4,
                            }}>
                              {msg.eval_metrics.overall_accuracy}% Match
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 14, marginTop: 8, color: COLORS.muted }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span>Retrieval Relevance</span>
                                <span style={{ fontWeight: 600 }}>{msg.eval_metrics.context_relevance}%</span>
                              </div>
                              <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${msg.eval_metrics.context_relevance}%`, background: COLORS.teal, borderRadius: 2 }} />
                              </div>
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span>Groundedness</span>
                                <span style={{ fontWeight: 600 }}>{msg.eval_metrics.faithfulness}%</span>
                              </div>
                              <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${msg.eval_metrics.faithfulness}%`, background: COLORS.teal, borderRadius: 2 }} />
                              </div>
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                <span>Answer Relevance</span>
                                <span style={{ fontWeight: 600 }}>{msg.eval_metrics.answer_relevance}%</span>
                              </div>
                              <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${msg.eval_metrics.answer_relevance}%`, background: COLORS.teal, borderRadius: 2 }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    style={{ display: "flex", gap: 11, alignItems: "flex-end" }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS.tealLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Bot size={13} color={COLORS.teal} />
                    </div>
                    <div style={{ padding: "12px 16px", background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: "4px 14px 14px 14px", display: "flex", gap: 9, alignItems: "center" }}>
                      <Loader2 size={14} color={COLORS.teal} className="animate-spin" />
                      <span style={{ fontSize: 13, color: COLORS.muted }}>Thinking…</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div style={{ padding: "14px 32px 20px", borderTop: `1px solid ${COLORS.border}`, background: "#fff", flexShrink: 0 }}>
              <input type="file" ref={fileInputRef} style={{ display: "none" }} accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.offWhite, borderRadius: 9, padding: "9px 12px", border: `1px solid ${COLORS.border}` }}>
                {/* Attach button */}
                <button
                  className="file-btn"
                  title={isUploading ? "Uploading…" : "Attach medical document"}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  style={{ background: "transparent", color: isUploading ? COLORS.teal : COLORS.muted }}
                >
                  {isUploading ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
                </button>

                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder="Ask about your health records…"
                  style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 500, color: COLORS.navy }}
                />

                <button
                  className="send-btn"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  style={{
                    background: inputValue.trim() ? COLORS.teal : COLORS.border,
                    color: inputValue.trim() ? COLORS.navy : COLORS.muted,
                    border: "none", width: 34, height: 34, borderRadius: 7,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: inputValue.trim() ? "pointer" : "default", flexShrink: 0,
                    boxShadow: inputValue.trim() ? "0 3px 8px rgba(0,201,167,0.25)" : "none",
                  }}
                >
                  <Send size={14} />
                </button>
              </div>
              <p style={{ fontSize: 11, color: COLORS.muted, margin: "7px 0 0 4px" }}>
                Tip: upload a report via 📎 and RogNidhi will use it as context.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, color: COLORS.muted }}>
            <div className="bot-icon-breathe" style={{ width: 52, height: 52, borderRadius: 12, background: COLORS.tealLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={26} color={COLORS.teal} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.navy, marginBottom: 5 }}>No active session</div>
              <div style={{ fontSize: 13 }}>Select a session or start a new chat.</div>
            </div>
            <button
              onClick={createNewSession}
              className="new-chat-pulse"
              style={{ background: COLORS.teal, color: COLORS.navy, border: "none", padding: "9px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
            >
              <Plus size={14} /> New Chat
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default RogNidhiHistory;
