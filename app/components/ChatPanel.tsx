"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, Bot, User, Info } from "lucide-react";
import { marked } from "marked";
import {
  GatewayBrowserClient,
  type GatewayEventFrame,
} from "../lib/openclaw/gatewayBrowserClient";

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
      content: "Connected to OpenClaw Dashboard. Start a conversation with the agent below.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connected, setConnected] = useState(false);
  const gwRef = useRef<GatewayBrowserClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionKeyRef = useRef<string>(
    "agent:main:webchat:direct:openclaw-spookling"
  );
  const runBuffersRef = useRef<Record<string, string>>({});

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
      // ignore
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
          const eventName =
            typeof evt.event === "string" ? evt.event.toLowerCase() : "";

          const isHeartbeatArtifact = (value: unknown): boolean => {
            if (!value || typeof value !== "object") return false;
            const obj = value as Record<string, unknown>;
            const direct =
              (typeof obj.text === "string" && obj.text === "HEARTBEAT_OK") ||
              (typeof obj.content === "string" &&
                obj.content === "HEARTBEAT_OK");
            if (direct) return true;
            const content = obj.content;
            if (!Array.isArray(content)) return false;
            return content.some((item) => {
              if (!item || typeof item !== "object") return false;
              const rec = item as Record<string, unknown>;
              return rec.type === "text" && rec.text === "HEARTBEAT_OK";
            });
          };

          const extractText = (value: unknown): string => {
            if (typeof value === "string") return value;
            if (!value || typeof value !== "object") return "";
            const obj = value as Record<string, unknown>;
            if (typeof obj.content === "string") return obj.content;
            if (typeof obj.text === "string") return obj.text;
            if (typeof obj.message === "string") return obj.message;
            if (typeof obj.delta === "string") return obj.delta;
            if (typeof obj.outputText === "string") return obj.outputText;
            if (typeof obj.final === "string") return obj.final;
            if (typeof obj.result === "string") return obj.result;
            if (Array.isArray(obj.content)) {
              const textParts = obj.content
                .map((part) => {
                  if (!part || typeof part !== "object") return "";
                  const rec = part as Record<string, unknown>;
                  return rec.type === "text" && typeof rec.text === "string"
                    ? rec.text
                    : "";
                })
                .filter(Boolean);
              if (textParts.length > 0) return textParts.join("\n");
            }
            return "";
          };

          if (eventName === "agent" || eventName === "chat") {
            const pObj =
              payload && typeof payload === "object"
                ? (payload as Record<string, unknown>)
                : null;
            const nestedData =
              pObj?.data && typeof pObj.data === "object"
                ? (pObj.data as Record<string, unknown>)
                : null;
            const genericState =
              (typeof pObj?.state === "string" && pObj.state) ||
              (typeof nestedData?.state === "string" && nestedData.state) ||
              "";
            const genericRunId =
              (typeof pObj?.runId === "string" && pObj.runId) ||
              (typeof nestedData?.runId === "string" && nestedData.runId) ||
              `anon-${Date.now()}`;
            const genericText =
              extractText(payload) ||
              extractText(pObj?.message) ||
              extractText(pObj?.payload) ||
              extractText(pObj?.data);
            const genericError =
              (typeof pObj?.errorMessage === "string" && pObj.errorMessage) ||
              (typeof pObj?.error === "string" && pObj.error) ||
              (nestedData &&
                typeof nestedData.errorMessage === "string" &&
                nestedData.errorMessage) ||
              (nestedData &&
                typeof nestedData.error === "string" &&
                nestedData.error) ||
              "";

            if (!genericText && !genericError) return;
            if (genericText && isHeartbeatArtifact({ text: genericText }))
              return;

            if (genericState === "delta") {
              if (genericText) {
                runBuffersRef.current[genericRunId] =
                  (runBuffersRef.current[genericRunId] || "") + genericText;
              }
              return;
            }

            if (
              genericState === "final" ||
              genericState === "error" ||
              genericState === "aborted"
            ) {
              const buffered = runBuffersRef.current[genericRunId] || "";
              const merged = (buffered + (genericText || "")).trim();
              delete runBuffersRef.current[genericRunId];
              setMessages((prev) => [
                ...prev,
                {
                  id: `msg-generic-${Date.now()}`,
                  role: genericState === "error" ? "system" : "assistant",
                  content:
                    merged ||
                    genericText ||
                    genericError ||
                    `[agent ${genericState}] no text payload`,
                  timestamp: new Date(),
                },
              ]);
              return;
            }

            if (genericText.trim().length < 8) return;
            setMessages((prev) => [
              ...prev,
              {
                id: `msg-generic-${Date.now()}`,
                role: "assistant",
                content: genericText,
                timestamp: new Date(),
              },
            ]);
            return;
          }

          const isChatEvent =
            payload &&
            typeof payload === "object" &&
            "sessionKey" in payload &&
            typeof (payload as { sessionKey?: unknown }).sessionKey ===
              "string" &&
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
          if (p.sessionKey && p.sessionKey !== sessionKeyRef.current) {
            sessionKeyRef.current = p.sessionKey;
            setMessages((prev) => [
              ...prev,
              {
                id: `sys-session-${Date.now()}`,
                role: "system",
                content: `Session switched: ${p.sessionKey}`,
                timestamp: new Date(),
              },
            ]);
          }

          const state = p.state;
          const msg = p.message;

          let content = "";
          if (typeof msg === "string") content = msg;
          else if (msg && typeof msg === "object") {
            if (isHeartbeatArtifact(msg)) return;
            const maybeContent = extractText(msg);
            content = maybeContent || JSON.stringify(msg);
          } else if (typeof p.errorMessage === "string" && p.errorMessage) {
            content = p.errorMessage;
          } else {
            return;
          }

          if (state !== "final" && state !== "error" && state !== "aborted")
            return;

          const finalContent =
            content && content.trim()
              ? content
              : `[empty assistant payload] state=${state}`;

          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: state === "error" ? "system" : "assistant",
              content: finalContent,
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
      void gw
        .request("chat.send", {
          sessionKey: sessionKeyRef.current,
          message: trimmed,
          idempotencyKey: crypto.randomUUID(),
        })
        .then((res) => {
          if (!res || typeof res !== "object") return;
          const r = res as Record<string, unknown>;
          const direct =
            (typeof r.content === "string" && r.content) ||
            (typeof r.text === "string" && r.text) ||
            (typeof r.message === "string" && r.message);
          if (!direct) return;
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: "assistant",
              content: direct,
              timestamp: new Date(),
            },
          ]);
        })
        .catch((err) => {
          const msg =
            err && typeof err === "object"
              ? JSON.stringify(err)
              : String(err ?? "Unknown send error");
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "system",
              content: `chat.send failed: ${msg}`,
              timestamp: new Date(),
            },
          ]);
        });
    }

    setInput("");
  };

  const renderMarkdown = (content: string) => {
    const html = marked.parse(content, { async: false }) as string;
    return { __html: html };
  };

  return (
    <section className="flex-1 flex flex-col p-8 overflow-hidden">
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-[3.5rem] font-bold leading-none tracking-tight text-on-surface mb-2">
          Agent Chat
        </h2>
        <div className="h-1 w-24 bg-primary" />
      </div>

      {/* Token input */}
      <div className="mb-4">
        <button
          onClick={() => setShowToken(!showToken)}
          className="text-xs font-bold uppercase tracking-widest text-on-surface/40 hover:text-primary transition-colors"
        >
          {showToken ? "Hide Token" : "Gateway Token"}
        </button>
        {showToken && (
          <input
            type="password"
            value={gatewayToken}
            onChange={(e) => {
              const value = e.target.value;
              setGatewayToken(value);
              try {
                window.localStorage.setItem("openclaw-gateway-token", value);
              } catch {
                // ignore
              }
            }}
            placeholder="Enter gateway token if auth is enabled"
            className="w-full mt-2 bg-surface-container-lowest border-0 border-l-2 border-outline-variant/30 py-3 pl-4 text-sm focus:ring-0 focus:border-primary placeholder:text-on-surface/20 transition-colors"
          />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 mb-6 pr-4">
        {messages.map((msg) => {
          if (msg.role === "system") {
            return (
              <div
                key={msg.id}
                className="flex gap-4 p-4 bg-surface-container-high/40"
              >
                <Info size={16} className="text-on-surface opacity-40 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-on-surface opacity-40 uppercase tracking-tight mb-1">
                    System — {msg.timestamp.toLocaleTimeString()}
                  </p>
                  <p className="text-sm text-on-surface opacity-60">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          }

          if (msg.role === "user") {
            return (
              <div key={msg.id} className="flex gap-4 justify-end">
                <div className="max-w-[70%]">
                  <div className="bg-primary/10 border-r-2 border-primary p-4">
                    <p className="text-sm text-on-surface">{msg.content}</p>
                  </div>
                  <p className="text-[10px] text-on-surface/30 mt-1 text-right">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                <div className="w-8 h-8 flex items-center justify-center shrink-0 bg-primary/20">
                  <User size={14} className="text-primary" />
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex gap-4">
              <div className="w-8 h-8 flex items-center justify-center shrink-0 bg-surface-container border-l-2 border-primary">
                <Bot size={14} className="text-primary" />
              </div>
              <div className="max-w-[70%]">
                <div className="bg-surface-container-low border-l-2 border-primary p-4">
                  <div
                    className="markdown-body text-sm"
                    dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                  />
                </div>
                <p className="text-[10px] text-on-surface/30 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reconnect */}
      {!connected && gatewayStatus === "online" && (
        <button
          onClick={connectWebSocket}
          className="w-full mb-4 py-3 border border-primary/20 text-primary text-sm font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
        >
          Reconnect WebSocket
        </button>
      )}

      {/* Input */}
      <div className="relative mt-auto">
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
          className="w-full bg-surface-container-lowest border-0 py-6 pl-6 pr-20 text-sm focus:ring-0 placeholder:text-on-surface/20 disabled:opacity-30 transition-all focus:bg-surface-bright/20"
        />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-outline-variant/20 overflow-hidden">
          <div className="h-full bg-primary w-1/4 animate-scan" />
        </div>
        <button
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-30 transition-colors"
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
