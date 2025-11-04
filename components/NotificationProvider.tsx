"use client";

import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Calendar, AlertTriangle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Notification = {
  id: string;
  type: "call" | "booking" | "escalation";
  title: string;
  message: string;
  timestamp: Date;
};

type NotificationProviderProps = {
  businessId?: string;
  children: React.ReactNode;
};

export function NotificationProvider({ businessId, children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mounted, setMounted] = useState(false);

  // Get business_id from props or sessionStorage
  const effectiveBusinessId = useMemo(() => {
    if (businessId) return businessId;
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("business_id") || undefined;
    }
    return undefined;
  }, [businessId]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const supabase = getSupabaseClient();
    let channels: ReturnType<typeof supabase.channel>[] = [];

    if (effectiveBusinessId) {
      const channel = supabase
        .channel(`business:CALLS:${effectiveBusinessId}`, { config: { private: true } })
        .on("broadcast", { event: "changes" }, (payload) => {
          const eventData = payload.payload;
          if (!eventData) return;

          let callData: any = null;
          let eventType = "UPDATE";

          if (eventData.data) {
            callData = eventData.data;
            eventType = eventData.eventType || eventData.operation || "UPDATE";
          } else if (eventData.new) {
            callData = eventData.new;
            eventType = "INSERT";
          }

          if (!callData) return;

          // Handle new call notifications
          if (eventType === "INSERT" || eventType === "insert") {
            addNotification({
              type: "call",
              title: "New Call",
              message: `${callData.patient_name || "Unknown"} called`,
            });
          }

          // Handle escalation notifications
          if (callData.escalate === true) {
            addNotification({
              type: "escalation",
              title: "Call Escalation",
              message: `${callData.patient_name || "Call"} requires attention`,
            });
          }

          // Handle booking notifications (check schedule JSONB)
          if (callData.schedule && typeof callData.schedule === "object") {
            addNotification({
              type: "booking",
              title: "New Booking",
              message: `Appointment scheduled for ${callData.patient_name || "patient"}`,
            });
          }
        })
        .subscribe();

      channels.push(channel);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [effectiveBusinessId, mounted]);

  function playDingSound() {
    // Create a simple ding sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Higher pitch for ding
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  }

  function addNotification(notif: Omit<Notification, "id" | "timestamp">) {
    const newNotif: Notification = {
      ...notif,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date(),
    };
    setNotifications((prev) => [...prev, newNotif]);

    // Play ding sound for new calls
    if (notif.type === "call") {
      playDingSound();
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
    }, 5000);
  }

  function removeNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <>
      {children}
      {mounted &&
        typeof window !== "undefined" &&
        createPortal(
          <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
            <AnimatePresence>
              {notifications.map((notif) => (
                <NotificationToast
                  key={notif.id}
                  notification={notif}
                  onClose={() => removeNotification(notif.id)}
                />
              ))}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </>
  );
}

function NotificationToast({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: () => void;
}) {
  const icons = {
    call: Phone,
    booking: Calendar,
    escalation: AlertTriangle,
  };

  const colors = {
    call: "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30",
    booking: "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30",
    escalation: "from-red-500/20 to-red-600/20 border-red-500/30",
  };

  const Icon = icons[notification.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.9 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={`pointer-events-auto bg-gradient-to-r ${colors[notification.type]} backdrop-blur-xl border rounded-2xl p-4 min-w-[320px] shadow-2xl`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-white/10">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm mb-1">
            {notification.title}
          </div>
          <div className="text-white/70 text-xs">
            {notification.message}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4 text-white/60" />
        </button>
      </div>
    </motion.div>
  );
}

