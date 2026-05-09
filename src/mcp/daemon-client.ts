import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readRuntimeState } from "../daemon/runtime-state";
import type { RpcRequest, RpcResponse } from "../shared/protocol";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../..");

export type DaemonClientOptions = {
	port?: number;
	host?: string;
};

export class DaemonClient {
	private port: number;
	private readonly host: string;
	private token: string | null = null;

	constructor(options: DaemonClientOptions = {}) {
		const rawPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 7898;
		const defaultPort = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 7898;
		this.port = options.port ?? defaultPort;
		this.host = options.host ?? "127.0.0.1";
	}

	async ensureRunning(): Promise<void> {
		const runtime = await readRuntimeState();
		if (runtime?.port) this.port = runtime.port;
		if (runtime?.token) this.token = runtime.token;

		if (!await this.isHealthy()) {
			const daemonPath = join(rootDir, "dist/browser/index.js");
			const child = spawn(process.execPath, [daemonPath], {
				detached: true,
				stdio: "ignore",
				env: { ...process.env, PORT: String(this.port), BCM_DAEMON_MODE: "1" },
			});
			child.unref();
			await this.waitForHealthy();
			// Re-read runtime state to get the token written by the newly started daemon
			const fresh = await readRuntimeState();
			if (fresh?.port) this.port = fresh.port;
			if (fresh?.token) this.token = fresh.token;
		}
	}

	async listSessions(): Promise<Record<string, unknown>> {
		await this.ensureRunning();
		return this.requestJson("GET", "/sessions");
	}

	async selectSession(sessionId: string): Promise<Record<string, unknown>> {
		await this.ensureRunning();
		return this.requestJson("POST", "/select-session", { sessionId }, 5000, true);
	}

	async sendBrowserRequest(request: RpcRequest): Promise<RpcResponse> {
		await this.ensureRunning();
		return this.requestJson("POST", "/rpc", request, 5000, true) as Promise<RpcResponse>;
	}

	private async isHealthy(): Promise<boolean> {
		try {
			const health = await this.requestJson("GET", "/health", undefined, 1000);
			return Boolean((health as { ok?: boolean }).ok);
		} catch {
			return false;
		}
	}

	private async waitForHealthy(): Promise<void> {
		const deadline = Date.now() + 5000;
		while (Date.now() < deadline) {
			if (await this.isHealthy()) return;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		throw new Error("Browser Console MCP daemon did not become healthy in time.");
	}

	private requestJson(
		method: "GET" | "POST",
		path: string,
		body?: unknown,
		timeoutMs = 5000,
		requireAuth = false,
	): Promise<Record<string, unknown>> {
		return new Promise((resolve, reject) => {
			const payload = body === undefined ? undefined : JSON.stringify(body);
			const headers: Record<string, string | number> = {};
			if (payload) {
				headers["Content-Type"] = "application/json";
				headers["Content-Length"] = Buffer.byteLength(payload);
			}
			if (requireAuth && this.token) {
				headers["Authorization"] = `Bearer ${this.token}`;
			}
			const req = httpRequest(
				{
					host: this.host,
					port: this.port,
					path,
					method,
					timeout: timeoutMs,
					headers,
				},
				(res) => {
					let data = "";
					res.on("data", (chunk: Buffer) => {
						data += chunk.toString();
					});
					res.on("end", () => {
						try {
							const parsed = data ? JSON.parse(data) : {};
							if ((res.statusCode ?? 500) >= 400) {
								const message =
									parsed?.error?.message || parsed?.error || `HTTP ${res.statusCode}`;
								reject(new Error(String(message)));
								return;
							}
							resolve(parsed);
						} catch (error) {
							reject(error);
						}
					});
				},
			);
			req.on("timeout", () => {
				req.destroy(new Error(`Request to daemon timed out after ${timeoutMs}ms.`));
			});
			req.on("error", reject);
			if (payload) req.write(payload);
			req.end();
		});
	}
}
