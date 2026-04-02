"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Brain,
  Activity,
  Settings,
  Plus,
} from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { MemoryStudio } from "./MemoryStudio";
import { HeartbeatMonitor } from "./HeartbeatMonitor";
import { GatewayControls } from "./GatewayControls";
import { DashboardOverview } from "./DashboardOverview";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "memory", label: "Memory Studio", icon: Brain },
  { id: "heartbeats", label: "Heartbeats", icon: Activity },
] as const;

export function Dashboard() {
  const [gatewayStatus, setGatewayStatus] = useState<
    "online" | "offline" | "checking"
  >("checking");
  const [activeTab, setActiveTab] = useState("dashboard");

  const checkGatewayStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/gateway/status");
      const data = await res.json();
      setGatewayStatus(data.status === "online" ? "online" : "offline");
    } catch {
      setGatewayStatus("offline");
    }
  }, []);

  useEffect(() => {
    checkGatewayStatus();
    const interval = setInterval(checkGatewayStatus, 5000);
    return () => clearInterval(interval);
  }, [checkGatewayStatus]);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full flex flex-col py-8 px-4 w-64 bg-background z-50">
        <div className="mb-12 px-4">
          <h1 className="text-2xl font-black text-primary tracking-tighter uppercase">
            OpenClaw
          </h1>
          <p className="text-[10px] font-bold text-on-surface opacity-40 tracking-[0.2em] mt-1">
            V0.1.2
          </p>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 font-bold text-lg uppercase tracking-tight transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? "text-primary border-l-2 border-primary bg-surface-container"
                    : "text-on-surface opacity-60 hover:bg-surface-bright hover:opacity-100"
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-4">
          <button className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-4 font-bold text-sm tracking-widest uppercase hover:opacity-90 transition-opacity">
            <Plus size={16} />
            New Session
          </button>
        </div>
      </aside>

      {/* Top Bar */}
      <header className="fixed top-0 right-0 flex justify-between items-center pl-72 pr-8 h-20 bg-surface-container-lowest/60 backdrop-blur-xl border-b border-outline-variant/15 z-40 w-full">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full">
            <span
              className={`w-2 h-2 rounded-full ${
                gatewayStatus === "online"
                  ? "bg-primary animate-pulse"
                  : gatewayStatus === "checking"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-error"
              }`}
            />
            <span
              className={`text-[10px] font-bold tracking-widest uppercase ${
                gatewayStatus === "online"
                  ? "text-primary"
                  : gatewayStatus === "checking"
                    ? "text-yellow-500"
                    : "text-error"
              }`}
            >
              Gateway{" "}
              {gatewayStatus === "online"
                ? "Online"
                : gatewayStatus === "checking"
                  ? "Checking"
                  : "Offline"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <GatewayControls
            status={gatewayStatus}
            onStatusChange={checkGatewayStatus}
          />
          <div className="flex items-center gap-4 border-l border-outline-variant/20 pl-6">
            <button className="text-on-surface opacity-60 hover:text-primary transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="ml-64 pt-20 flex-1 flex overflow-hidden">
        {activeTab === "dashboard" && (
          <DashboardOverview gatewayStatus={gatewayStatus} />
        )}
        {activeTab === "chat" && <ChatPanel gatewayStatus={gatewayStatus} />}
        {activeTab === "memory" && <MemoryStudio />}
        {activeTab === "heartbeats" && (
          <HeartbeatMonitor gatewayStatus={gatewayStatus} />
        )}
      </main>
    </div>
  );
}
