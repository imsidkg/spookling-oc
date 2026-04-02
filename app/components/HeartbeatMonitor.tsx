"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Heart,
  Clock,
  HardDrive,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface HeartbeatEvent {
  id: string;
  type: "heartbeat" | "flush" | "status" | "error";
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

interface HeartbeatMonitorProps {
  gatewayStatus: "online" | "offline" | "checking";
}

export function HeartbeatMonitor({ gatewayStatus }: HeartbeatMonitorProps) {
  const [events, setEvents] = useState<HeartbeatEvent[]>([]);
  const [stats, setStats] = useState({
    lastHeartbeat: null as Date | null,
    heartbeatCount: 0,
    flushCount: 0,
    sessionId: "N/A",
    agentStatus: gatewayStatus,
  });

  const pollHeartbeats = useCallback(async () => {
    if (gatewayStatus !== "online") return;

    try {
      const res = await fetch("/api/gateway/status");
      const data = await res.json();

      const now = new Date();
      const newEvent: HeartbeatEvent = {
        id: `hb-${Date.now()}`,
        type: "heartbeat",
        message: `Gateway heartbeat — PID ${data.pid || "unknown"}`,
        timestamp: now,
        data,
      };

      setEvents((prev) => [newEvent, ...prev].slice(0, 100));
      setStats((prev) => ({
        ...prev,
        lastHeartbeat: now,
        heartbeatCount: prev.heartbeatCount + 1,
        sessionId: data.sessionId || data.pid?.toString() || "N/A",
        agentStatus: data.status || gatewayStatus,
      }));
    } catch {
      setEvents((prev) =>
        [
          {
            id: `err-${Date.now()}`,
            type: "error" as const,
            message: "Failed to fetch heartbeat",
            timestamp: new Date(),
          },
          ...prev,
        ].slice(0, 100)
      );
    }
  }, [gatewayStatus]);

  useEffect(() => {
    pollHeartbeats();
    const interval = setInterval(pollHeartbeats, 5000);
    return () => clearInterval(interval);
  }, [pollHeartbeats]);

  useEffect(() => {
    if (gatewayStatus !== "online") return;

    const checkFlush = async () => {
      try {
        const res = await fetch("/api/memory/read");
        const data = await res.json();
        if (data.files) {
          const recentlyModified = data.files.filter(
            (f: { lastModified: string }) => {
              const mod = new Date(f.lastModified);
              const diff = Date.now() - mod.getTime();
              return diff < 6000;
            }
          );

          if (recentlyModified.length > 0) {
            const flushEvent: HeartbeatEvent = {
              id: `flush-${Date.now()}`,
              type: "flush",
              message: `Memory flush detected: ${recentlyModified.map((f: { name: string }) => f.name).join(", ")}`,
              timestamp: new Date(),
            };
            setEvents((prev) => [flushEvent, ...prev].slice(0, 100));
            setStats((prev) => ({
              ...prev,
              flushCount: prev.flushCount + 1,
            }));
          }
        }
      } catch {
        // Silently fail
      }
    };

    const interval = setInterval(checkFlush, 5000);
    return () => clearInterval(interval);
  }, [gatewayStatus]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "heartbeat":
        return <Heart size={14} className="text-primary" />;
      case "flush":
        return <HardDrive size={14} className="text-secondary" />;
      case "error":
        return <AlertTriangle size={14} className="text-error" />;
      default:
        return <Zap size={14} className="text-tertiary" />;
    }
  };

  const getEventBorder = (type: string) => {
    switch (type) {
      case "heartbeat":
        return "border-l-primary";
      case "flush":
        return "border-l-secondary";
      case "error":
        return "border-l-error";
      default:
        return "border-l-tertiary";
    }
  };

  return (
    <section className="flex-1 flex flex-col p-8 overflow-hidden">
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-[3.5rem] font-bold leading-none tracking-tight text-on-surface mb-2">
          Heartbeat Monitor
        </h2>
        <div className="h-1 w-24 bg-primary" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-container p-6 border-l-2 border-primary">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-primary mb-3">
            Last Heartbeat
          </p>
          <p className="text-xl font-bold">
            {stats.lastHeartbeat
              ? formatDistanceToNow(stats.lastHeartbeat, { addSuffix: true })
              : "—"}
          </p>
        </div>

        <div className="bg-surface-container p-6 border-l-2 border-secondary">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-secondary mb-3">
            Heartbeats
          </p>
          <p className="text-xl font-bold">{stats.heartbeatCount}</p>
        </div>

        <div className="bg-surface-container p-6 border-l-2 border-tertiary">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-tertiary mb-3">
            Memory Flushes
          </p>
          <p className="text-xl font-bold">{stats.flushCount}</p>
        </div>

        <div className="bg-surface-container p-6 border-l-2 border-outline">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-outline mb-3">
            Session PID
          </p>
          <p className="text-xl font-bold truncate">{stats.sessionId}</p>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-6 py-4 border-l-2 border-primary bg-surface-container-low flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              gatewayStatus === "online"
                ? "bg-primary animate-pulse-dot"
                : "bg-error"
            }`}
          />
          <span className="text-sm font-bold uppercase tracking-tight">
            Agent:{" "}
            <span
              className={
                gatewayStatus === "online" ? "text-primary" : "text-error"
              }
            >
              {gatewayStatus === "online" ? "Running" : "Stopped"}
            </span>
          </span>
        </div>
        <span className="text-xs text-on-surface/30 font-bold uppercase tracking-widest">
          Polling 5s
        </span>
      </div>

      {/* Event Log */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 bg-surface-container-lowest border-b border-outline-variant/10">
          <span className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-on-surface/40">
            Event Log ({events.length})
          </span>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-on-surface/30">
              <Activity size={32} className="mb-3 opacity-20" />
              <p className="text-sm font-bold uppercase tracking-widest">
                {gatewayStatus === "online"
                  ? "Waiting for heartbeats..."
                  : "Start Gateway"}
              </p>
            </div>
          ) : (
            <div>
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`px-4 py-3 flex items-start gap-3 border-l-2 ${getEventBorder(event.type)} border-b border-outline-variant/5 hover:bg-surface-container-high/20 transition-colors`}
                >
                  <div className="mt-0.5">{getEventIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{event.message}</p>
                    {event.data && (
                      <pre className="text-[10px] text-on-surface/30 mt-1 overflow-x-auto font-mono">
                        {JSON.stringify(event.data, null, 0)}
                      </pre>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-on-surface/30 shrink-0">
                    <Clock size={10} />
                    {event.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
