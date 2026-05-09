import type { WebSocket } from "ws";
import type {
	BrowserHelloPayload,
	BrowserSessionSnapshot,
	ConnectionMode,
	SessionStatus,
} from "../shared/protocol";

export type BrowserSession = BrowserSessionSnapshot & {
	ws: WebSocket;
	pendingRequests: Set<string>;
};

type RegisterInput = {
	ws: WebSocket;
	sessionId: string;
	clientId: string;
	payload: BrowserHelloPayload;
};

export class SessionRegistry {
	private readonly sessions = new Map<string, BrowserSession>();
	private activeSessionId: string | null = null;

	register(input: RegisterInput): BrowserSession {
		const now = Date.now();
		const existing = this.sessions.get(input.sessionId);
		const mode: ConnectionMode = input.payload.mode ?? "console";

		if (existing) {
			existing.ws = input.ws;
			existing.clientId = input.clientId;
			existing.mode = mode;
			existing.tabId = input.payload.tabId;
			existing.frameId = input.payload.frameId;
			existing.url = input.payload.url;
			existing.title = input.payload.title;
			existing.capabilities = input.payload.capabilities ?? [];
			existing.status = "connected";
			existing.lastSeenAt = now;
			existing.generation += 1;
			this.activeSessionId = existing.sessionId;
			return existing;
		}

		const session: BrowserSession = {
			ws: input.ws,
			pendingRequests: new Set(),
			sessionId: input.sessionId,
			clientId: input.clientId,
			mode,
			tabId: input.payload.tabId,
			frameId: input.payload.frameId,
			url: input.payload.url,
			title: input.payload.title,
			status: "connected",
			capabilities: input.payload.capabilities ?? [],
			connectedAt: now,
			lastSeenAt: now,
			generation: 0,
		};

		this.sessions.set(session.sessionId, session);
		this.activeSessionId = session.sessionId;
		return session;
	}

	touch(sessionId: string): void {
		const session = this.sessions.get(sessionId);
		if (!session) return;
		session.lastSeenAt = Date.now();
		if (session.status !== "closed") session.status = "connected";
	}

	markBySocket(ws: WebSocket, status: SessionStatus): void {
		for (const session of this.sessions.values()) {
			if (session.ws === ws) {
				session.status = status;
				session.lastSeenAt = Date.now();
			}
		}
	}

	markStaleOlderThan(maxIdleMs: number): void {
		const cutoff = Date.now() - maxIdleMs;
		for (const session of this.sessions.values()) {
			if (session.status === "connected" && session.lastSeenAt < cutoff) {
				session.status = "stale";
			}
		}
	}

	get(sessionId: string): BrowserSession | undefined {
		return this.sessions.get(sessionId);
	}

	select(sessionId: string): BrowserSession | undefined {
		const session = this.sessions.get(sessionId);
		if (!session) return undefined;
		this.activeSessionId = sessionId;
		return session;
	}

	getActive(): BrowserSession | undefined {
		if (this.activeSessionId) {
			const session = this.sessions.get(this.activeSessionId);
			if (session?.status === "connected") return session;
		}

		const connected = [...this.sessions.values()]
			.filter((session) => session.status === "connected")
			.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
		const next = connected[0];
		if (next) this.activeSessionId = next.sessionId;
		return next;
	}

	list(): BrowserSessionSnapshot[] {
		return [...this.sessions.values()]
			.sort((a, b) => b.lastSeenAt - a.lastSeenAt)
			.map((session) => this.snapshot(session));
	}

	get activeId(): string | null {
		return this.activeSessionId;
	}

	snapshot(session: BrowserSession): BrowserSessionSnapshot {
		return {
			sessionId: session.sessionId,
			clientId: session.clientId,
			mode: session.mode,
			tabId: session.tabId,
			frameId: session.frameId,
			url: session.url,
			title: session.title,
			status: session.status,
			capabilities: session.capabilities,
			connectedAt: session.connectedAt,
			lastSeenAt: session.lastSeenAt,
			generation: session.generation,
		};
	}
}
