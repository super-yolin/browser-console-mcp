import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import {
	createProtocolMessage,
	parseProtocolMessage,
	type BrowserCommandType,
	type BrowserHelloPayload,
	type RpcRequest,
	type RpcResponse,
} from "../shared/protocol";
import { clearRuntimeState, writeRuntimeState } from "./runtime-state";
import { SessionRegistry, type BrowserSession } from "./session-registry";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../..");
const packageVersion = "1.2.0";

export type DaemonOptions = {
	port?: number;
	host?: string;
	writeRuntime?: boolean;
};

type PendingRequest = {
	resolve: (value: Record<string, unknown>) => void;
	reject: (error: Error) => void;
	timer: NodeJS.Timeout;
	session: BrowserSession;
};

const STATIC_FILES: Record<string, { path: string; contentType: string }> = {
	"/browser-mcp-server.js": {
		path: join(rootDir, "dist/browser/browser-mcp-server.js"),
		contentType: "application/javascript",
	},
	"/browser-inject.js": {
		path: join(rootDir, "dist/browser/browser-inject.js"),
		contentType: "application/javascript",
	},
	"/browser-console-mcp.js": {
		path: join(rootDir, "dist/client/browser-console-mcp.js"),
		contentType: "application/javascript",
	},
	"/browser-console-mcp.js.map": {
		path: join(rootDir, "dist/client/browser-console-mcp.js.map"),
		contentType: "application/json",
	},
};

export class BrowserConsoleDaemon {
	private readonly registry = new SessionRegistry();
	private readonly pending = new Map<string, PendingRequest>();
	private readonly port: number;
	private readonly host: string;
	private readonly writeRuntime: boolean;
	private readonly token: string = randomUUID();
	private heartbeatTimer: NodeJS.Timeout | null = null;

	private readonly httpServer = createServer((req, res) => {
		this.handleHttp(req, res).catch((error: Error) => {
			res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
			res.end(JSON.stringify({ error: error.message }));
		});
	});

	private readonly wss = new WebSocketServer({ server: this.httpServer });

	constructor(options: DaemonOptions = {}) {
		const rawPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 7898;
		const defaultPort = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 7898;
		this.port = options.port ?? defaultPort;
		this.host = options.host ?? "127.0.0.1";
		this.writeRuntime = options.writeRuntime ?? true;
		this.wss.on("connection", (ws, req) => {
			if (!this.isValidHost(req)) {
				ws.close(1008, "Invalid host");
				return;
			}
			const url = new URL(req.url || "", `http://${req.headers.host}`);
			if (url.pathname === "/browser") {
				this.handleBrowserConnection(ws);
				return;
			}
			ws.close(1008, "Unsupported WebSocket path");
		});
	}

	async start(): Promise<void> {
		await new Promise<void>((resolve) => {
			this.httpServer.listen(this.port, this.host, resolve);
		});
		this.startHeartbeat();
		if (this.writeRuntime) {
			await writeRuntimeState({
				pid: process.pid,
				port: this.port,
				startedAt: Date.now(),
				version: packageVersion,
				token: this.token,
			});
		}
		console.error(`[BCM Daemon] listening on http://${this.host}:${this.port}`);
	}

	async stop(): Promise<void> {
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(new Error("Daemon stopped before browser responded."));
		}
		this.pending.clear();
		for (const client of this.wss.clients) {
			client.close();
		}
		await new Promise<void>((resolve) => this.wss.close(() => resolve()));
		await new Promise<void>((resolve) => this.httpServer.close(() => resolve()));
		if (this.writeRuntime) await clearRuntimeState();
	}

	async sendBrowserRequest(request: RpcRequest): Promise<RpcResponse> {
		const session = request.sessionId
			? this.registry.get(request.sessionId)
			: this.registry.getActive();

		if (!session || session.status !== "connected" || session.ws.readyState !== WebSocket.OPEN) {
			return {
				ok: false,
				error: {
					code: "NO_BROWSER_SESSION",
					message:
						"No connected browser session. Use console injection, the Vite plugin, or the Chrome extension first.",
					retryable: true,
				},
			};
		}

		const result = await this.dispatchToSession(session, request);
		return {
			ok: true,
			session: this.registry.snapshot(session),
			result,
		};
	}

	private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
		if (!this.isValidHost(req)) {
			res.writeHead(421, { "Content-Type": "text/plain" });
			res.end("Misdirected Request");
			return;
		}

		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}

		if (req.method === "GET" && req.url === "/health") {
			this.json(res, {
				ok: true,
				pid: process.pid,
				port: this.port,
				version: packageVersion,
				uptime: process.uptime(),
			});
			return;
		}

		if (req.method === "GET" && (req.url === "/status" || req.url === "/sessions")) {
			this.json(res, this.statusPayload());
			return;
		}

		if (req.method === "POST" && req.url === "/rpc") {
			if (!this.isAuthorized(req)) {
				res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ error: "Unauthorized" }));
				return;
			}
			const body = (await this.readJson(req)) as RpcRequest;
			const response = await this.sendBrowserRequest(body);
			this.json(res, response, response.ok ? 200 : 409);
			return;
		}

		if (req.method === "POST" && req.url === "/select-session") {
			if (!this.isAuthorized(req)) {
				res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ error: "Unauthorized" }));
				return;
			}
			const body = (await this.readJson(req)) as { sessionId?: string };
			if (!body.sessionId || !this.registry.select(body.sessionId)) {
				this.json(res, { ok: false, error: "Session not found" }, 404);
				return;
			}
			this.json(res, { ok: true, activeSessionId: body.sessionId });
			return;
		}

		const url = req.url?.split("?")[0] ?? "/";
		const staticFile = STATIC_FILES[url];
		if (req.method === "GET" && staticFile) {
			try {
				const content = await fs.readFile(staticFile.path, "utf8");
				res.writeHead(200, { "Content-Type": staticFile.contentType });
				res.end(content);
			} catch {
				res.writeHead(404);
				res.end("Not Found");
			}
			return;
		}

		res.writeHead(200, {
			"Content-Type": "text/html; charset=utf-8",
			"Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
			"X-Content-Type-Options": "nosniff",
		});
		res.end(this.buildIndexPage());
	}

	private handleBrowserConnection(ws: WebSocket): void {
		ws.send(JSON.stringify({
			type: "connection_status",
			status: "connected",
			message: "Connected to Browser Console MCP daemon",
		}));

		ws.on("message", (data) => {
			this.handleBrowserMessage(ws, data.toString());
		});

		ws.on("close", () => {
			this.registry.markBySocket(ws, "reconnecting");
			this.rejectPendingForSocket(ws);
		});

		ws.on("error", (err) => {
			console.error("[BCM Daemon] WebSocket error:", err.message);
			this.registry.markBySocket(ws, "reconnecting");
			this.rejectPendingForSocket(ws);
		});
	}

	private handleBrowserMessage(ws: WebSocket, raw: string): void {
		const protocolMessage = parseProtocolMessage(raw);
		if (protocolMessage?.type === "hello") {
			const session = this.registry.register({
				ws,
				sessionId: protocolMessage.sessionId || randomUUID(),
				clientId: protocolMessage.clientId || randomUUID(),
				payload: protocolMessage.payload as BrowserHelloPayload,
			});
			ws.send(JSON.stringify(createProtocolMessage("hello_ack", {
				clientId: session.clientId,
				sessionId: session.sessionId,
			})));
			return;
		}

		if (protocolMessage?.type === "ping" || protocolMessage?.type === "pong") {
			if (protocolMessage.sessionId) this.registry.touch(protocolMessage.sessionId);
			if (protocolMessage.type === "ping") {
				ws.send(JSON.stringify(createProtocolMessage("pong", {
					clientId: protocolMessage.clientId,
					sessionId: protocolMessage.sessionId,
				})));
			}
			return;
		}

		let message: Record<string, unknown>;
		try {
			message = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return;
		}

		const requestId = typeof message.requestId === "string" ? message.requestId : undefined;
		if (!requestId) return;
		const pending = this.pending.get(requestId);
		if (!pending) return;

		this.pending.delete(requestId);
		pending.session.pendingRequests.delete(requestId);
		clearTimeout(pending.timer);
		if (message.error) {
			pending.reject(new Error(String(message.error)));
		} else {
			pending.resolve(message);
		}
	}

	private dispatchToSession(
		session: BrowserSession,
		request: RpcRequest,
	): Promise<Record<string, unknown>> {
		return new Promise((resolve, reject) => {
			const requestId = randomUUID();
			const timeoutMs = request.timeoutMs ?? 5000;
			const timer = setTimeout(() => {
				this.pending.delete(requestId);
				session.pendingRequests.delete(requestId);
				reject(new Error(`Request timed out after ${timeoutMs}ms.`));
			}, timeoutMs);

			this.pending.set(requestId, { resolve, reject, timer, session });
			session.pendingRequests.add(requestId);
			session.ws.send(JSON.stringify({
				type: request.type,
				requestId,
				...(request.payload ?? {}),
			}));
		});
	}

	private startHeartbeat(): void {
		this.heartbeatTimer = setInterval(() => {
			this.registry.markStaleOlderThan(30000);
			for (const session of this.registry.list()) {
				const current = this.registry.get(session.sessionId);
				if (current?.ws.readyState === WebSocket.OPEN) {
					current.ws.send(JSON.stringify({ type: "ping" }));
				}
			}
		}, 10000);
	}

	private statusPayload(): Record<string, unknown> {
		const sessions = this.registry.list();
		return {
			ok: true,
			pid: process.pid,
			port: this.port,
			version: packageVersion,
			activeSessionId: this.registry.activeId,
			browserCount: sessions.filter((session) => session.status === "connected").length,
			cursorCount: 0,
			sessions,
		};
	}

	private isValidHost(req: IncomingMessage): boolean {
		const host = req.headers.host;
		return host === `127.0.0.1:${this.port}` || host === `localhost:${this.port}`;
	}

	private isAuthorized(req: IncomingMessage): boolean {
		return req.headers.authorization === `Bearer ${this.token}`;
	}

	private rejectPendingForSocket(ws: WebSocket): void {
		for (const [requestId, pending] of this.pending) {
			if (pending.session.ws === ws) {
				clearTimeout(pending.timer);
				pending.reject(new Error("Browser session disconnected."));
				pending.session.pendingRequests.delete(requestId);
				this.pending.delete(requestId);
			}
		}
	}

	private json(res: ServerResponse, body: unknown, status = 200): void {
		res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
		res.end(JSON.stringify(body, null, 2));
	}

	private readJson(req: IncomingMessage): Promise<unknown> {
		return new Promise((resolve, reject) => {
			let body = "";
			req.on("data", (chunk: Buffer) => {
				body += chunk.toString();
			});
			req.on("end", () => {
				try {
					resolve(body ? JSON.parse(body) : {});
				} catch (error) {
					reject(error);
				}
			});
			req.on("error", reject);
		});
	}

	private buildIndexPage(): string {
		const wsUrl = `ws://localhost:${this.port}/browser`;
		return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Browser Console MCP</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 960px; margin: 0 auto; padding: 20px; }
      pre { background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
      code { font-family: monospace; }
      .bookmarklet { display: inline-block; padding: 8px 12px; background-color: #f0f0f0; border-radius: 4px; text-decoration: none; color: #333; border: 1px solid #ccc; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #ddd; padding: 6px; text-align: left; }
    </style>
  </head>
  <body>
    <h1>Browser Console MCP</h1>
    <p>Daemon is running on port ${this.port}. Active sessions: <span id="bc">0</span></p>

    <h2>1. Console 注入</h2>
    <p>适合临时调试。刷新或跨页面跳转后可能需要重新注入。</p>
    <a class="bookmarklet" href="javascript:(function(){var s=document.createElement('script');s.src='http://localhost:${this.port}/browser-inject.js';document.head.appendChild(s);})();">Browser MCP</a>
    <pre><code>var s = document.createElement('script');
s.src = 'http://localhost:${this.port}/browser-inject.js';
document.head.appendChild(s);</code></pre>

    <h2>2. 前端插件</h2>
    <pre><code>import { browserConsoleMCP } from 'browser-console-mcp/vite';

export default {
  plugins: [browserConsoleMCP()]
};</code></pre>

    <h2>3. Chrome 扩展</h2>
    <p>适合第三方网站、MPA 和多 tab 自动注入。加载本仓库的 <code>extension/</code> 目录。</p>

    <h2>Sessions</h2>
    <table>
      <thead><tr><th>Mode</th><th>Status</th><th>Title</th><th>URL</th><th>Session</th></tr></thead>
      <tbody id="sessions"></tbody>
    </table>

    <script>
      function refresh() {
        fetch('/status').then(function(r) { return r.json(); }).then(function(d) {
          document.getElementById('bc').textContent = d.browserCount;
          var tbody = document.getElementById('sessions');
          tbody.replaceChildren();
          (d.sessions || []).forEach(function(s) {
            var row = document.createElement('tr');
            [s.mode, s.status, s.title || '', s.url || '', s.sessionId].forEach(function(v, i) {
              var td = document.createElement('td');
              if (i === 4) {
                var code = document.createElement('code');
                code.textContent = v ?? '';
                td.appendChild(code);
              } else {
                td.textContent = v ?? '';
              }
              row.appendChild(td);
            });
            tbody.appendChild(row);
          });
        }).catch(function() {});
      }
      refresh();
      setInterval(refresh, 5000);
    </script>
  </body>
</html>`;
	}
}

export async function startDaemon(options: DaemonOptions = {}): Promise<BrowserConsoleDaemon> {
	const daemon = new BrowserConsoleDaemon(options);
	await daemon.start();
	return daemon;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const daemon = await startDaemon();
	const shutdown = async () => {
		await daemon.stop();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
	process.on("uncaughtException", (error) => {
		console.error("[BCM Daemon] Uncaught exception:", error);
	});
	process.on("unhandledRejection", (reason) => {
		console.error("[BCM Daemon] Unhandled rejection:", reason);
	});
}
