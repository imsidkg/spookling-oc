"use client";

import { useState, useEffect } from "react";
import { Info, Network, Clock, Brain, Activity, Cpu } from "lucide-react";

interface DashboardOverviewProps {
  gatewayStatus: "online" | "offline" | "checking";
}

interface StatusData {
  pid: string | null;
  port: number;
  timestamp: string;
}

interface MemoryStats {
  fileCount: number;
  totalSize: number;
  lastModified: string | null;
}

export function DashboardOverview({ gatewayStatus }: DashboardOverviewProps) {
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({
    fileCount: 0,
    totalSize: 0,
    lastModified: null,
  });
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/gateway/status");
        const data = await res.json();
        setStatusData(data);
      } catch {
        // ignore
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchMemory = async () => {
      try {
        const res = await fetch("/api/memory/read");
        const data = await res.json();
        if (data.files) {
          const totalSize = data.files.reduce(
            (acc: number, f: { size: number }) => acc + f.size,
            0
          );
          const lastMod = data.files.length
            ? data.files.reduce(
                (latest: string, f: { lastModified: string }) =>
                  f.lastModified > latest ? f.lastModified : latest,
                data.files[0].lastModified
              )
            : null;
          setMemoryStats({
            fileCount: data.files.length,
            totalSize,
            lastModified: lastMod,
          });
        }
      } catch {
        // ignore
      }
    };
    fetchMemory();
    const interval = setInterval(fetchMemory, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setUptime((u) => u + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <section className="flex-1 flex flex-col p-8 overflow-hidden">
      {/* Hero Heading */}
      <div className="mb-12">
        <h2 className="text-[3.5rem] font-bold leading-none tracking-tight text-on-surface mb-2">
          Terminal Dashboard
        </h2>
        <div className="h-1 w-24 bg-primary" />
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 mb-8 pr-4">
        {/* System Message */}
        <div className="flex gap-4 p-6 bg-surface-container-low border-l-2 border-primary">
          <div className="flex-shrink-0 mt-1">
            <Info size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-tight mb-1">
              System
            </p>
            <p className="text-on-surface opacity-80">
              Connected to OpenClaw Dashboard. Gateway protocol v3 active.
              Ed25519 device authentication enabled.
            </p>
          </div>
        </div>

        {/* Gateway Message */}
        <div className="flex gap-4 p-6 bg-surface-container-low border-l-2 border-primary">
          <div className="flex-shrink-0 mt-1">
            <Network size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-tight mb-1">
              Gateway
            </p>
            <p className="text-on-surface opacity-80">
              {gatewayStatus === "online"
                ? `Connected to Gateway on ws://127.0.0.1:18789${statusData?.pid ? ` — PID ${statusData.pid}` : ""}. Status: nominal.`
                : "Gateway offline. Start the gateway to connect."}
            </p>
          </div>
        </div>

        {/* Archive Log */}
        <div className="flex gap-4 p-6 bg-surface-container-high/40">
          <div className="flex-shrink-0 mt-1">
            <Clock size={16} className="text-on-surface opacity-40" />
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface opacity-40 uppercase tracking-tight mb-1">
              Archive Log — {new Date().toLocaleTimeString()}
            </p>
            <p className="text-on-surface opacity-60">
              {memoryStats.fileCount > 0
                ? `${memoryStats.fileCount} memory files indexed. Total size: ${(memoryStats.totalSize / 1024).toFixed(1)}KB. Workspace ready for retrieval.`
                : "No memory files found. Start the agent to generate workspace files."}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="bg-surface-container p-6 border-l-2 border-secondary">
            <p className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-secondary mb-4">
              Gateway
            </p>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold">
                  {gatewayStatus === "online" ? "LIVE" : "OFF"}
                </span>
                <span className="text-xs opacity-40 ml-2">:18789</span>
              </div>
              <Activity size={32} className="text-secondary/50" />
            </div>
          </div>

          <div className="bg-surface-container p-6 border-l-2 border-primary">
            <p className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-primary mb-4">
              Memory Files
            </p>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold">
                  {memoryStats.fileCount}
                </span>
                <span className="text-xs opacity-40 ml-2">
                  {(memoryStats.totalSize / 1024).toFixed(1)}KB
                </span>
              </div>
              <Brain size={32} className="text-primary/50" />
            </div>
          </div>

          <div className="bg-surface-container p-6 border-l-2 border-tertiary">
            <p className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-tertiary mb-4">
              Session Uptime
            </p>
            <div className="flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold font-mono">
                  {formatUptime(uptime)}
                </span>
              </div>
              <Cpu size={32} className="text-tertiary/50" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="relative mt-auto">
        <div className="w-full bg-surface-container-lowest py-6 pl-6 pr-20 text-on-surface/40 text-sm">
          {gatewayStatus === "online"
            ? "Gateway connected — switch to Chat to interact with the agent"
            : "Awaiting gateway connection..."}
        </div>
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-outline-variant/20 overflow-hidden">
          <div className="h-full bg-primary w-1/4 animate-scan" />
        </div>
      </div>
    </section>
  );
}
