"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Bot, User, AlertCircle } from "lucide-react";
import { marked } from "marked";
import { GatewayBrowserClient, type GatewayEventFrame } from "../lib/openclaw/gatewayBrowserClient";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  gatewayStatus: "online" | "offline" | "checking";
}

export function ChatPanel({ gatewayStatus }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "Connected to OpenClaw Dashboard. Start a conversation with the agent below.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");
  const [connected, setConnected] = useState(false);
  const gwRef = useRef<GatewayBrowserClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionKeyRef = useRef<string>("agent:main:webchat:direct:openclaw-spookling");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("openclaw-gateway-token");
      if (stored) setGatewayToken(stored);
    } catch {
      // ignore localStorage failures
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (gatewayStatus !== "online") return;

    try {
      const gw = new GatewayBrowserClient({
        url: "ws://127.0.0.1:18789",
        token: gatewayToken.trim() || undefined,
        onHello: () => {
          setConnected(true);
          setMessages((prev) => [
            ...prev,
            {
              id: `sys-${Date.now()}`,
              role: "system",
              content: "Connected to OpenClaw Gateway.",
              timestamp: new Date(),
            },
          ]);
        },
        onConnectError: (err) => {
          const msg =
            err && typeof err === "object"
              ? JSON.stringify(err)
              : String(err ?? "Unknown connect error");
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "system",
              content: `Gateway connect failed: ${msg}`,
              timestamp: new Date(),
            },
          ]);
        },
        onEvent: (evt: GatewayEventFrame) => {
          const payload: unknown = evt.payload;

          // Heuristic: gateway chat events carry { sessionKey, state, message?, errorMessage? }.
          const isChatEvent =
            payload &&
            typeof payload === "object" &&
            "sessionKey" in payload &&
            typeof (payload as { sessionKey?: unknown }).sessionKey === "string" &&
            "state" in payload &&
            typeof (payload as { state?: unknown }).state === "string" &&
            ("message" in payload || "errorMessage" in payload);

          if (!isChatEvent) return;
          const p = payload as {
            sessionKey: string;
            state: string;
            message?: unknown;
            errorMessage?: unknown;
          };
          if (p.sessionKey !== sessionKeyRef.current) return;

          const state = p.state;
          const msg = p.message;

          const isHeartbeatArtifact = (value: unknown): boolean => {
            if (!value || typeof value !== "object") return false;
            const obj = value as Record<string, unknown>;
            const direct =
              (typeof obj.text === "string" && obj.text === "HEARTBEAT_OK") ||
              (typeof obj.content === "string" && obj.content === "HEARTBEAT_OK");
            if (direct) return true;

            const content = obj.content;
            if (!Array.isArray(content)) return false;
            return content.some((item) => {
              if (!item || typeof item !== "object") return false;
              const rec = item as Record<string, unknown>;
              return rec.type === "text" && rec.text === "HEARTBEAT_OK";
            });
          };

          let content = "";
          if (typeof msg === "string") content = msg;
          else if (msg && typeof msg === "object") {
            // Ignore non-user-facing heartbeat acknowledgement events.
            if (isHeartbeatArtifact(msg)) return;
            const m = msg as Record<string, unknown>;
            const maybeContent =
              (typeof m.content === "string" && m.content) ||
              (typeof m.text === "string" && m.text) ||
              (typeof m.message === "string" && m.message) ||
              (typeof m.delta === "string" && m.delta) ||
              "";
            content = maybeContent || JSON.stringify(m);
          } else if (typeof p.errorMessage === "string" && p.errorMessage) {
            content = p.errorMessage;
          } else {
            return;
          }

          // We only append on final/error/aborted to avoid spamming on deltas.
          if (state !== "final" && state !== "error" && state !== "aborted") return;

          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: state === "error" ? "system" : "assistant",
              content,
              timestamp: new Date(),
            },
          ]);
        },
        onClose: () => {
          setConnected(false);
        },
      });

      gwRef.current = gw;
      gw.start();
    } catch {
      setConnected(false);
    }
  }, [gatewayStatus, gatewayToken]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      gwRef.current?.stop();
    };
  }, [connectWebSocket]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      },
    ]);

    const gw = gwRef.current;
    if (gw?.connected) {
      void gw.request("chat.send", {
        sessionKey: sessionKeyRef.current,
        message: trimmed,
        idempotencyKey: crypto.randomUUID(),
      });
    }

    setInput("");
  };

  const renderMarkdown = (content: string) => {
    const html = marked.parse(content, { async: false }) as string;
    return { __html: html };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            {msg.role !== "user" && (
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.role === "assistant"
                    ? "bg-primary/10 text-primary"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot size={16} />
                ) : (
                  <AlertCircle size={16} />
                )}
              </div>
            )}
            <div
              className={`max-w-[70%] rounded-xl px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : msg.role === "assistant"
                    ? "bg-card border border-border"
                    : "bg-secondary/50 border border-border/50 text-muted-foreground text-sm"
              }`}
            >
              {msg.role === "assistant" ? (
                <div
                  className="markdown-body text-sm"
                  dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                />
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
              <p className="text-[10px] opacity-50 mt-1">
                {msg.timestamp.toLocaleTimeString()}
              </p>
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/20 text-primary">
                <User size={16} />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="mb-3">
          <input
            type="password"
            value={gatewayToken}
            onChange={(e) => {
              const value = e.target.value;
              setGatewayToken(value);
              try {
                window.localStorage.setItem("openclaw-gateway-token", value);
              } catch {
                // ignore localStorage failures
              }
            }}
            placeholder="Gateway token (required if auth is enabled)"
            className="w-full bg-card border border-border rounded-xl px-4 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        {!connected && gatewayStatus === "online" && (
          <button
            onClick={connectWebSocket}
            className="w-full mb-3 py-2 rounded-lg bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors"
          >
            Reconnect WebSocket
          </button>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={
              connected
                ? "Send a message to OpenClaw..."
                : "Gateway offline — start it to chat"
            }
            disabled={!connected}
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!connected || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
