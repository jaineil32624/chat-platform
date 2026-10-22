import type { TransportEvent } from "./types";
import { uid } from "./utils";

// Pluggable realtime transport. By default, events fan out between browser
// tabs over BroadcastChannel (open two tabs, log in as two users, and chat in
// real time). If NEXT_PUBLIC_SOCKET_URL is set, events also go through the
// Socket.IO relay in /server so different devices can talk to each other.

type Handler = (ev: TransportEvent) => void;

export interface Transport {
  readonly clientId: string;
  readonly kind: string;
  publish(ev: TransportEvent): void;
  subscribe(h: Handler): () => void;
  connect(opts: { userId?: string }): void;
  close(): void;
}

class BroadcastTransport implements Transport {
  readonly kind = "broadcast-channel";
  readonly clientId = uid("client");
  private channel?: BroadcastChannel;
  private handlers = new Set<Handler>();
  private socket?: { emit: (e: string, d: unknown) => void; disconnect: () => void };
  private seen = new Set<string>();

  constructor() {
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("pulse-realtime-v1");
      this.channel.onmessage = (e) => this.deliver(e.data as TransportEvent);
    }
  }

  private deliver(ev: TransportEvent) {
    if (!ev?.id || ev.origin === this.clientId || this.seen.has(ev.id)) return;
    this.seen.add(ev.id);
    if (this.seen.size > 5000) this.seen = new Set([...this.seen].slice(-2000));
    this.handlers.forEach((h) => h(ev));
  }

  async connect({ userId }: { userId?: string }) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!url || this.socket) return;
    try {
      const { io } = await import("socket.io-client");
      const s = io(url, { auth: { clientId: this.clientId, userId, workspace: "public" }, transports: ["websocket", "polling"] });
      s.on("event", (ev: TransportEvent) => {
        this.deliver(ev);
        this.channel?.postMessage(ev); // re-fan to sibling tabs
      });
      this.socket = s;
    } catch (err) {
      console.warn("[pulse] socket transport unavailable", err);
    }
  }

  publish(ev: TransportEvent) {
    this.seen.add(ev.id);
    this.channel?.postMessage(ev);
    this.socket?.emit("event", ev);
  }

  subscribe(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  close() {
    this.channel?.close();
    this.socket?.disconnect();
  }
}

let instance: Transport | undefined;
export function getTransport(): Transport {
  if (!instance) instance = new BroadcastTransport();
  return instance;
}

/** Elect a single "simulation leader" tab via the Web Locks API so bots don't double-post. */
export function electLeader(onLeader: () => () => void): () => void {
  let release: (() => void) | undefined;
  let stop: (() => void) | undefined;
  let cancelled = false;
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (!locks) {
    stop = onLeader();
    return () => stop?.();
  }
  locks.request("pulse-sim-leader", () => new Promise<void>((resolve) => {
    if (cancelled) return resolve();
    release = resolve;
    stop = onLeader();
  }));
  return () => {
    cancelled = true;
    stop?.();
    release?.();
  };
}
