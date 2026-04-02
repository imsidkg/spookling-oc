"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

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
      setTimeout(() => {
        onStatusChange();
        setLoading(null);
      }, 2000);
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => gatewayAction("start")}
        disabled={status === "online" || loading !== null}
        className="px-6 py-2 border border-primary/20 text-primary font-medium text-sm tracking-wide hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {loading === "start" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          "Start"
        )}
      </button>
      <button
        onClick={() => gatewayAction("stop")}
        disabled={status === "offline" || loading !== null}
        className="px-6 py-2 border border-outline-variant/30 text-on-surface opacity-60 font-medium text-sm tracking-wide hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {loading === "stop" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          "Stop"
        )}
      </button>
    </div>
  );
}
