import { loadOrCreateDeviceIdentity, signDevicePayload } from "./deviceIdentity";

export type GatewayEventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: unknown;
};

export type GatewayResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
};

export type GatewayHelloOk = {
  type: "hello-ok";
  protocol: number;
  policy?: { tickIntervalMs?: number };
  features?: { methods?: string[]; events?: string[] };
  auth?: { deviceToken?: string; role?: string; scopes?: string[] };
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
};

export type GatewayBrowserClientOptions = {
  url: string;
  token?: string;
  password?: string;
  onHello?: (hello: GatewayHelloOk) => void;
  onEvent?: (evt: GatewayEventFrame) => void;
  onConnectError?: (err: unknown) => void;
  onClose?: (info: { code: number; reason: string }) => void;
};

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback: not cryptographically strong, but good enough for request IDs.
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce: string;
  platform: string | null;
  deviceFamily: string | null;
}): string {
  const normalizeDeviceMetadataForAuth = (value?: string | null): string => {
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (!trimmed) return "";
    // Match OpenClaw's deterministic ASCII-only lowercasing.
    return trimmed.replace(/[A-Z]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) + 32)
    );
  };

  // Mirror OpenClaw's device auth payload builder (v3).
  // Format: v3|deviceId|clientId|clientMode|role|scopesCsv|signedAtMs|tokenOrEmpty|nonce|platform|deviceFamily
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
    params.nonce ?? "",
    normalizeDeviceMetadataForAuth(params.platform),
    normalizeDeviceMetadataForAuth(params.deviceFamily),
  ].join("|");
}

export class GatewayBrowserClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private closed = false;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: number | null = null;

  constructor(private opts: GatewayBrowserClientOptions) {}

  start() {
    this.closed = false;
    this.connect();
  }

  stop() {
    this.closed = true;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("gateway client stopped"));
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private connect() {
    if (this.closed) return;
    this.ws = new WebSocket(this.opts.url);
    this.ws.addEventListener("open", () => this.queueConnect());
    this.ws.addEventListener("message", (ev) => this.handleMessage(String(ev.data ?? "")));
    this.ws.addEventListener("close", (ev) => {
      const reason = String(ev.reason ?? "");
      this.ws = null;
      this.flushPending(new Error(`gateway closed (${ev.code}): ${reason}`));
      this.opts.onClose?.({ code: ev.code, reason });
    });
    this.ws.addEventListener("error", () => {
      // close handler will fire
    });
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  private queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer !== null) window.clearTimeout(this.connectTimer);
    this.connectTimer = window.setTimeout(() => void this.sendConnect(), 2500);
  }

  private async sendConnect() {
    if (!this.connectNonce) return;
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer !== null) {
      window.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const role = "operator";
    const scopes = ["operator.read", "operator.write", "operator.admin", "operator.approvals", "operator.pairing"];

    const client = {
      id: "openclaw-control-ui",
      version: "openclaw-spookling",
      platform: navigator.platform ?? "web",
      deviceFamily: "browser",
      mode: "webchat",
    };

    const identity = await loadOrCreateDeviceIdentity();
    let device: undefined | { id: string; publicKey: string; signature: string; signedAt: number; nonce: string };
    if (identity) {
      const signedAtMs = Date.now();
      const nonce = this.connectNonce ?? "";
      const payload = buildDeviceAuthPayload({
        deviceId: identity.deviceId,
        clientId: client.id,
        clientMode: client.mode,
        role,
        scopes,
        signedAtMs,
        token: this.opts.token?.trim() || null,
        nonce,
        platform: client.platform ?? null,
        deviceFamily: client.deviceFamily ?? null,
      });
      const signature = await signDevicePayload(identity.privateKey, payload);
      device = {
        id: identity.deviceId,
        publicKey: identity.publicKey,
        signature,
        signedAt: signedAtMs,
        nonce,
      };
    }

    try {
      const hello = (await this.request("connect", {
        minProtocol: 3,
        maxProtocol: 3,
        client,
        role,
        scopes,
        caps: ["tool-events"],
        auth:
          this.opts.token || this.opts.password
            ? {
                token: this.opts.token,
                password: this.opts.password,
              }
            : undefined,
        device,
        userAgent: navigator.userAgent,
        locale: navigator.language,
      })) as GatewayHelloOk;

      this.opts.onHello?.(hello);
    } catch (err) {
      this.opts.onConnectError?.(err);
      // Connection will be closed by server if connect fails.
      this.ws?.close(4008, "connect failed");
    }
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: unknown };
    if (frame.type === "event") {
      const evt = parsed as GatewayEventFrame;
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: unknown } | undefined;
        const nonce = payload && typeof payload.nonce === "string" ? payload.nonce : null;
        if (nonce) {
          this.connectNonce = nonce;
          void this.sendConnect();
        }
        return;
      }
      this.opts.onEvent?.(evt);
      return;
    }

    if (frame.type === "res") {
      const res = parsed as GatewayResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (res.ok) pending.resolve(res.payload);
      else pending.reject(res.error ?? new Error("request failed"));
      return;
    }
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = uuid();
    const frame = { type: "req", id, method, params };
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (v) => resolve(v as T), reject });
    });
    this.ws.send(JSON.stringify(frame));
    return p;
  }
}

