"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Heart,
  Clock,
  Cpu,
  HardDrive,
  Zap,
  AlertTriangle,
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
    uptime: "0s",
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
        uptime: data.uptime || `${prev.heartbeatCount * 5}s`,
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

  // Detect memory flushes by watching file changes
  useEffect(() => {
    if (gatewayStatus !== "online") return;

    const checkFlush = async () => {
      try {
        const res = await fetch("/api/memory/read");
        const data = await res.json();
        if (data.files) {
          const recentlyModified = data.files.filter((f: { lastModified: string }) => {
            const mod = new Date(f.lastModified);
            const diff = Date.now() - mod.getTime();
            return diff < 6000; // Modified in last 6 seconds
          });

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
        // Silently fail flush checks
      }
    };

    const interval = setInterval(checkFlush, 5000);
    return () => clearInterval(interval);
  }, [gatewayStatus]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "heartbeat":
        return <Heart size={14} className="text-emerald-400" />;
      case "flush":
        return <HardDrive size={14} className="text-blue-400" />;
      case "error":
        return <AlertTriangle size={14} className="text-red-400" />;
      default:
        return <Zap size={14} className="text-yellow-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b border-border">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Heart size={14} />
            <span className="text-xs font-medium">Last Heartbeat</span>
          </div>
          <p className="text-lg font-semibold">
            {stats.lastHeartbeat
              ? formatDistanceToNow(stats.lastHeartbeat, { addSuffix: true })
              : "—"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Activity size={14} />
            <span className="text-xs font-medium">Heartbeats</span>
          </div>
          <p className="text-lg font-semibold">{stats.heartbeatCount}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <HardDrive size={14} />
            <span className="text-xs font-medium">Memory Flushes</span>
          </div>
          <p className="text-lg font-semibold">{stats.flushCount}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Cpu size={14} />
            <span className="text-xs font-medium">Session</span>
          </div>
          <p className="text-lg font-semibold truncate">{stats.sessionId}</p>
        </div>
      </div>

      {/* Agent status bar */}
      <div className="px-4 py-3 border-b border-border bg-card/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              gatewayStatus === "online"
                ? "bg-emerald-500 animate-pulse-dot"
                : "bg-red-500"
            }`}
          />
          <span className="text-sm font-medium">
            Agent Status:{" "}
            <span
              className={
                gatewayStatus === "online"
                  ? "text-emerald-400"
                  : "text-red-400"
              }
            >
              {gatewayStatus === "online" ? "Running" : "Stopped"}
            </span>
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          Polling every 5s
        </span>
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 border-b border-border/50 bg-secondary/30 sticky top-0">
          <span className="text-xs font-medium text-muted-foreground">
            Event Log ({events.length} events)
          </span>
        </div>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Activity size={32} className="mb-3 opacity-30" />
            <p className="text-sm">
              {gatewayStatus === "online"
                ? "Waiting for heartbeats..."
                : "Start the Gateway to see heartbeats"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {events.map((event) => (
              <div
                key={event.id}
                className="px-4 py-2.5 flex items-start gap-3 hover:bg-secondary/20 transition-colors"
              >
                <div className="mt-0.5">{getEventIcon(event.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{event.message}</p>
                  {event.data && (
                    <pre className="text-[10px] text-muted-foreground mt-1 overflow-x-auto">
                      {JSON.stringify(event.data, null, 0)}
                    </pre>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                  <Clock size={10} />
                  {event.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
