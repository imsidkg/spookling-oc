"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import {
  MessageSquare,
  Brain,
  Activity,
  Power,
  RotateCcw,
  Square,
} from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { MemoryStudio } from "./MemoryStudio";
import { HeartbeatMonitor } from "./HeartbeatMonitor";
import { GatewayControls } from "./GatewayControls";

export function Dashboard() {
  const [gatewayStatus, setGatewayStatus] = useState<
    "online" | "offline" | "checking"
  >("checking");
  const [activeTab, setActiveTab] = useState("chat");

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
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">&#x1F99E;</span>
            <span className="text-primary">OpenClaw</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Full-Stack Dashboard
          </p>
        </div>

        {/* Gateway status */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                gatewayStatus === "online"
                  ? "bg-emerald-500 animate-pulse-dot"
                  : gatewayStatus === "checking"
                    ? "bg-yellow-500 animate-pulse-dot"
                    : "bg-red-500"
              }`}
            />
            <span className="text-sm font-medium">
              Gateway{" "}
              {gatewayStatus === "online"
                ? "Online"
                : gatewayStatus === "checking"
                  ? "Checking..."
                  : "Offline"}
            </span>
          </div>
          <GatewayControls
            status={gatewayStatus}
            onStatusChange={checkGatewayStatus}
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3">
          <button
            onClick={() => setActiveTab("chat")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === "chat"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <MessageSquare size={18} />
            Chat
          </button>
          <button
            onClick={() => setActiveTab("memory")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mt-1 ${
              activeTab === "memory"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Brain size={18} />
            Memory Studio
          </button>
          <button
            onClick={() => setActiveTab("heartbeats")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mt-1 ${
              activeTab === "heartbeats"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Activity size={18} />
            Heartbeats
          </button>
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground">
            Built for Spookling application
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">v1.0.0 MVP</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border flex items-center px-6 justify-between shrink-0">
          <h2 className="font-semibold capitalize">
            {activeTab === "chat"
              ? "Chat with OpenClaw Agent"
              : activeTab === "memory"
                ? "Memory Studio"
                : "Heartbeat Monitor"}
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>ws://127.0.0.1:18789</span>
            <div
              className={`w-2 h-2 rounded-full ${
                gatewayStatus === "online" ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {activeTab === "chat" && <ChatPanel gatewayStatus={gatewayStatus} />}
          {activeTab === "memory" && <MemoryStudio />}
          {activeTab === "heartbeats" && (
            <HeartbeatMonitor gatewayStatus={gatewayStatus} />
          )}
        </div>
      </main>
    </div>
  );
}
