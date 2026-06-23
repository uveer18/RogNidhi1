import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckSquare, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../config';

const COLORS = {
  navy: "#0A1628",
  navyMid: "#112240",
  teal: "#00C9A7",
  muted: "#64748B",
  border: "#E2E8F0",
  white: "#FFFFFF",
  error: "#EF4444"
};

// Extremely subtle, short pop sound encoded in base64 to avoid external dependencies
const NOTIFICATION_SOUND = "data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
// Wait, generating a valid mp3 base64 by hand is hard and might fail to decode.
// I will use a reliable, tiny base64 audio string representing a generic "pop" or "ping".
const PING_SOUND_B64 = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=="; // This is actually an empty wav file to act as a placeholder. We will try to rely on browser's Audio synthesis instead to avoid large base64 strings!

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // To avoid playing sound on initial load, track if first fetch is done
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const playSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // Slide up to A6
      
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio context not supported", e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("access");
      if (!token) return;
      const res = await fetch(`${API_BASE_URL}/api/notifications/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        const currentUnread = data.filter((n: any) => !n.is_read).length;
        
        if (initialLoadDone && currentUnread > unreadCount) {
          // Play sound ONLY if we gained new unread notifications compared to last fetch
          playSound();
        }
        
        setNotifications(data);
        setUnreadCount(currentUnread);
        if (!initialLoadDone) setInitialLoadDone(true);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [initialLoadDone, unreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("access");
      await fetch(`${API_BASE_URL}/api/notifications/${id}/read/`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      // Optimistically update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="bell-breathe" 
        style={{
          width: 40, height: 40, borderRadius: 12, background: COLORS.white, 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          border: `1px solid ${COLORS.border}`, cursor: 'pointer', position: 'relative'
        }}
      >
        <Bell size={20} color={unreadCount > 0 ? COLORS.navy : COLORS.muted} />
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute', top: -4, right: -4, background: COLORS.error, 
            color: '#fff', fontSize: 10, fontWeight: 800, width: 18, height: 18, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
            boxShadow: `0 0 0 2px ${COLORS.white}`
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              position: 'absolute', top: 52, right: 0, width: 340, 
              background: COLORS.white, borderRadius: 16, border: `1px solid ${COLORS.border}`,
              boxShadow: '0 12px 32px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 999
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, background: '#FAFAFA'
            }}>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: COLORS.navy }}>Notifications</h4>
              {unreadCount > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.teal, background: 'rgba(0, 201, 167, 0.1)', padding: '4px 10px', borderRadius: 8 }}>
                  {unreadCount} New
                </span>
              )}
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: COLORS.muted }}>
                  <BellRing size={32} color={COLORS.border} strokeWidth={1} style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 14, fontWeight: 600 }}>You're all caught up!</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>No notifications to display.</div>
                </div>
              ) : (
                notifications.map((notif: any) => (
                  <div key={notif.id} style={{
                    padding: '14px 20px',
                    display: 'flex', gap: 14,
                    background: notif.is_read ? 'transparent' : 'rgba(0, 201, 167, 0.04)',
                    borderLeft: `3px solid ${notif.is_read ? 'transparent' : COLORS.teal}`,
                    borderBottom: `1px solid ${COLORS.border}`,
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: notif.is_read ? COLORS.navyMid : COLORS.navy }}>
                          {notif.title}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted }}>
                          {notif.created_at.split(',')[0]}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
                        {notif.message}
                      </p>
                    </div>
                    {!notif.is_read && (
                      <button 
                        onClick={(e) => markAsRead(e, notif.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4, 
                          color: COLORS.teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          alignSelf: 'center', borderRadius: 6
                        }}
                        title="Mark as read"
                      >
                        <CheckSquare size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
