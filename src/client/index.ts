import { PageAgent } from "./page-agent";
import {
	createProtocolMessage,
	type BrowserCommandType,
	type ConnectionMode,
} from "../shared/protocol";

type MCPMessage = {
	type: string;
	payload?: Record<string, unknown>;
	requestId?: string;
	code?: string;
	message?: string;
	selector?: string;
	text?: string;
};

interface MCPConsole {
	exec: (command: string) => string;
	disconnect: () => string;
	reconnect: () => string;
	status: () => Record<string, unknown>;
	help: () => string;
}

// Extend global Window interface
declare global {
	interface Window {
		mcp: MCPConsole;
		__BCM_CONFIG__?: {
			serverUrl?: string;
			mode?: ConnectionMode;
		};
	}
}

class BrowserConsoleMCP {
	private ws: WebSocket | null = null;
	private serverUrl: string;
	private connected = false;
	private reconnectAttempts = 0;
	private reconnectTimer: number | null = null;
	private heartbeatTimer: number | null = null;
	private readonly maxReconnectDelay = 30000;
	private readonly pageAgent = new PageAgent();
	private readonly clientId: string;
	private readonly sessionId: string;
	private readonly mode: ConnectionMode;

	constructor(serverUrl = "ws://localhost:7898/browser", mode: ConnectionMode = "console") {
		this.serverUrl = serverUrl;
		this.mode = mode;
		this.clientId = this.getOrCreateId("bcm_client_id");
		this.sessionId = this.getOrCreateId("bcm_session_id", true);
	}

	connect(): void {
		try {
			this.pageAgent
				.loadHtml2Canvas()
				.then(() => {
					this.clearReconnectTimer();
					if (this.ws) this.ws.close();
					this.ws = new WebSocket(this.serverUrl);

					this.ws.onopen = () => {
						this.connected = true;
						this.reconnectAttempts = 0;
						console.log("%c[MCP Client] Connected to server", "color: green");
						this.sendHello();
						this.startHeartbeat();
						this.registerConsoleCommands();
					};

					this.ws.onmessage = (event) => {
						try {
							const message: MCPMessage = JSON.parse(event.data);
							this.handleServerMessage(message);
						} catch (error) {
							console.error("[MCP Client] Message parsing error:", error);
						}
					};

					this.ws.onclose = () => {
						this.connected = false;
						this.stopHeartbeat();
						console.log(
							"%c[MCP Client] Disconnected from server",
							"color: orange",
						);
						this.scheduleReconnect();
					};

					this.ws.onerror = (error) => {
						console.error("[MCP Client] WebSocket error:", error);
					};
				})
				.catch((error: Error) => {
					console.error("[MCP Client] Failed to load html2canvas:", error);
				});
		} catch (error) {
			console.error("[MCP Client] Connection error:", error);
		}
	}

	private async handleServerMessage(message: MCPMessage): Promise<void> {
		if (message.type === "ping") {
			this.sendRaw(createProtocolMessage("pong", {
				clientId: this.clientId,
				sessionId: this.sessionId,
			}));
			return;
		}

		const requestId = message.requestId;
		if (requestId && this.pageAgent.capabilities.includes(message.type)) {
			try {
				const result = await this.pageAgent.handleCommand({
					...message,
					type: message.type as BrowserCommandType,
				});
				this.sendResponse(requestId, result);
			} catch (error) {
				this.sendError(requestId, (error as Error).message);
			}
			return;
		}

		// Handle other message types
		switch (message.type) {
			case "command_result":
				console.log(`%c[MCP Server] ${message.payload?.result}`, "color: blue");
				break;
			case "error":
				console.error(`[MCP Server] Error: ${message.payload?.error}`);
				break;
			case "connection_status":
				console.log(`%c[MCP Server] ${message.message}`, "color: green");
				break;
			default:
				// Only log message type, not full message content
				console.log(`[MCP Server] Received message type: ${message.type}`);
		}
	}

	/**
	 * Send response
	 */
	private sendResponse(requestId: string, data: Record<string, unknown>): void {
		if (!this.connected || !this.ws) {
			console.error(
				"[MCP Client] Not connected to server, cannot send response",
			);
			return;
		}

		const response = {
			requestId,
			sessionId: this.sessionId,
			...data,
		};

		this.ws.send(JSON.stringify(response));
	}

	/**
	 * Send error response
	 */
	private sendError(requestId: string, errorMessage: string): void {
		if (!this.connected || !this.ws) {
			console.error(
				"[MCP Client] Not connected to server, cannot send error response",
			);
			return;
		}

		const response = {
			requestId,
			sessionId: this.sessionId,
			error: errorMessage,
		};

		this.ws.send(JSON.stringify(response));
	}

	/**
	 * Send command to server
	 */
	sendCommand(command: string): void {
		if (!this.connected || !this.ws) {
			console.error("[MCP Client] Not connected to server");
			return;
		}

		const message: MCPMessage = {
			type: "command",
			payload: { command },
		};

		this.ws.send(JSON.stringify(message));
	}

	private sendHello(): void {
		this.sendRaw(createProtocolMessage("hello", {
			clientId: this.clientId,
			sessionId: this.sessionId,
			payload: {
				mode: this.mode,
				url: window.location.href,
				title: document.title,
				capabilities: this.pageAgent.capabilities,
			},
		}));
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatTimer = window.setInterval(() => {
			this.sendRaw(createProtocolMessage("ping", {
				clientId: this.clientId,
				sessionId: this.sessionId,
			}));
		}, 15000);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer !== null) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer !== null) return;
		const delay = Math.min(500 * 2 ** this.reconnectAttempts, this.maxReconnectDelay);
		this.reconnectAttempts++;
		this.reconnectTimer = window.setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, delay);
	}

	private clearReconnectTimer(): void {
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}

	private sendRaw(message: unknown): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}

	private getOrCreateId(key: string, perPage = false): string {
		if (perPage && typeof sessionStorage !== "undefined") {
			const sessionValue = sessionStorage.getItem(key);
			if (sessionValue) return sessionValue;
			const id = crypto.randomUUID();
			sessionStorage.setItem(key, id);
			return id;
		}
		const stored = localStorage.getItem(key);
		if (stored) return stored;
		const id = crypto.randomUUID();
		localStorage.setItem(key, id);
		return id;
	}

	/**
	 * Register console commands
	 */
	private registerConsoleCommands(): void {
		// Define global commands
		window.mcp = {
			exec: (command: string) => {
				this.sendCommand(command);
				return "Command sent";
			},
			disconnect: () => {
				if (this.ws) {
					this.ws.close();
					this.ws = null;
				}
				return "Disconnected";
			},
			reconnect: () => {
				this.connect();
				return "Reconnecting...";
			},
			status: () => ({
				connected: this.connected,
				clientId: this.clientId,
				sessionId: this.sessionId,
				mode: this.mode,
				url: window.location.href,
				title: document.title,
			}),
			help: () => {
				return `
MCP Client Commands:
  mcp.exec(command) - Execute a command
  mcp.disconnect() - Disconnect from server
  mcp.reconnect() - Reconnect to server
  mcp.status() - Show connection/session status
  mcp.help() - Show help information
        `;
			},
		};

		console.log(
			"%c[MCP Client] Console commands registered, use mcp.help() to see available commands",
			"color: green",
		);
	}

}

function getRuntimeConfig(): { serverUrl: string; mode: ConnectionMode } {
	const currentScript = document.currentScript as HTMLScriptElement | null;
	const scriptUrl = currentScript?.src ? new URL(currentScript.src) : null;
	const mode = window.__BCM_CONFIG__?.mode ?? scriptUrl?.searchParams.get("mode") ?? "console";

	return {
		serverUrl:
			window.__BCM_CONFIG__?.serverUrl ??
			scriptUrl?.searchParams.get("serverUrl") ??
			"ws://localhost:7898/browser",
		mode: mode === "plugin" || mode === "extension" ? mode : "console",
	};
}

const runtimeConfig = getRuntimeConfig();

// Create and connect client instance
const client = new BrowserConsoleMCP(
	runtimeConfig.serverUrl,
	runtimeConfig.mode,
);
client.connect();

// Export client instance
export default client;
