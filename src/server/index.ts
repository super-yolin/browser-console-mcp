/**
 * Browser Console MCP Server
 *
 * This server runs in Cursor and handles commands from the browser console
 */

import { exec } from "node:child_process";
import * as http from "node:http";
import "node:process";
import { type WebSocket, WebSocketServer } from "ws";
import { StaticFileServer } from "./static-server.js";

interface MCPMessage {
	type: string;
	payload?: Record<string, unknown>;
}

interface Client {
	id: string;
	ws: WebSocket;
}

class BrowserConsoleMCPServer {
	private wss: WebSocketServer;
	private clients: Map<string, Client> = new Map();
	private port: number;
	private staticServer: StaticFileServer;
	private httpServer: http.Server;

	constructor(port = 3000, staticPort = 3001) {
		this.port = port;
		// Create HTTP server
		this.httpServer = http.createServer((req, res) => {
			// Redirect to static server
			res.writeHead(302, {
				Location: `http://localhost:${staticPort}${req.url}`,
			});
			res.end();
		});

		// Attach WebSocket server to HTTP server
		this.wss = new WebSocketServer({
			server: this.httpServer,
			path: "/ws", // Specify WebSocket path
		});

		this.staticServer = new StaticFileServer(staticPort);
	}

	/**
	 * Start server
	 */
	start(): void {
		this.setupWebSocketServer();
		this.staticServer.start();

		// Start HTTP server
		this.httpServer.listen(this.port, () => {
			console.log(`[MCP Server] HTTP server started on port ${this.port}`);
			console.log(
				`[MCP Server] WebSocket server path: ws://localhost:${this.port}/ws`,
			);
			console.log(
				`[MCP Server] Static files will be redirected to port ${this.staticServer.getPort()}`,
			);
		});
	}

	/**
	 * Setup WebSocket server
	 */
	private setupWebSocketServer(): void {
		this.wss.on("connection", (ws: WebSocket) => {
			const clientId = this.generateClientId();
			this.clients.set(clientId, { id: clientId, ws });

			console.log(`[MCP Server] Client ${clientId} connected`);

			ws.on("message", (data: Buffer) => {
				try {
					const message: MCPMessage = JSON.parse(data.toString());
					this.handleClientMessage(clientId, message);
				} catch (error) {
					console.error("[MCP Server] Message parsing error:", error);
				}
			});

			ws.on("close", () => {
				this.clients.delete(clientId);
				console.log(`[MCP Server] Client ${clientId} disconnected`);
			});

			ws.on("error", (error: Error) => {
				console.error(
					`[MCP Server] WebSocket error (client ${clientId}):`,
					error,
				);
			});
		});

		this.wss.on("error", (error: Error) => {
			console.error("[MCP Server] WebSocket server error:", error);
		});
	}

	/**
	 * Handle client messages
	 */
	private handleClientMessage(clientId: string, message: MCPMessage): void {
		const client = this.clients.get(clientId);
		if (!client) {
			console.error(`[MCP Server] Client not found: ${clientId}`);
			return;
		}

		// Only log message type, not the full message content
		console.log(
			`[MCP Server] Received message type ${message.type} from client ${clientId}`,
		);

		switch (message.type) {
			case "command":
				this.executeCommand(client, message.payload?.command as string);
				break;
			default:
				this.sendErrorToClient(client, `Unknown message type: ${message.type}`);
		}
	}

	/**
	 * Execute command
	 */
	private executeCommand(client: Client, command: string): void {
		if (!command) {
			this.sendErrorToClient(client, "Command is empty");
			return;
		}

		console.log(`[MCP Server] Executing command: ${command}`);

		exec(command, (error: Error | null, stdout: string, stderr: string) => {
			if (error) {
				this.sendErrorToClient(
					client,
					`Command execution error: ${error.message}`,
				);
				return;
			}

			const result = stdout || stderr;
			this.sendResultToClient(client, result);
		});
	}

	/**
	 * Send result to client
	 */
	private sendResultToClient(client: Client, result: string): void {
		const message: MCPMessage = {
			type: "command_result",
			payload: { result },
		};

		client.ws.send(JSON.stringify(message));
	}

	/**
	 * Send error to client
	 */
	private sendErrorToClient(client: Client, error: string): void {
		const message: MCPMessage = {
			type: "error",
			payload: { error },
		};

		client.ws.send(JSON.stringify(message));
	}

	/**
	 * Generate client ID
	 */
	private generateClientId(): string {
		return `client_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
	}

	/**
	 * Stop server
	 */
	stop(): void {
		this.httpServer.close();
		this.wss.close();
		this.staticServer.stop();
		console.log("[MCP Server] Server closed");
	}
}

// Create and start server instance
const server = new BrowserConsoleMCPServer();
server.start();

// Handle process exit
process.on("SIGINT", () => {
	console.log("[MCP Server] Shutting down server...");
	server.stop();
	process.exit(0);
});

export default server;
