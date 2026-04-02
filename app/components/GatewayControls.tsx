"use client";

import { useState } from "react";
import { Power, RotateCcw, Square, Loader2 } from "lucide-react";

interface GatewayControlsProps {
  status: "online" | "offline" | "checking";
  onStatusChange: () => void;
}

export function GatewayControls({
  status,
  onStatusChange,
}: GatewayControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const gatewayAction = async (action: "start" | "stop") => {
    setLoading(action);
    try {
      await fetch(`/api/gateway/${action}`, { method: "POST" });
      // Give the gateway a moment to start/stop
      setTimeout(() => {
        onStatusChange();
        setLoading(null);
      }, 2000);
    } catch {
      setLoading(null);
    }
  };

  const restart = async () => {
    setLoading("restart");
    try {
      await fetch("/api/gateway/stop", { method: "POST" });
      await new Promise((r) => setTimeout(r, 2000));
      await fetch("/api/gateway/start", { method: "POST" });
      setTimeout(() => {
        onStatusChange();
        setLoading(null);
      }, 2000);
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => gatewayAction("start")}
        disabled={status === "online" || loading !== null}
        className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading === "start" ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Power size={13} />
        )}
        Start
      </button>
      <button
        onClick={() => gatewayAction("stop")}
        disabled={status === "offline" || loading !== null}
        className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading === "stop" ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Square size={13} />
        )}
        Stop
      </button>
      <button
        onClick={restart}
        disabled={loading !== null}
        className="flex items-center justify-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading === "restart" ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <RotateCcw size={13} />
        )}
      </button>
    </div>
  );
}
