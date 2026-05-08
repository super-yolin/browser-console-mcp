import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type WebSocket, WebSocketServer } from "ws";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../..");

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 7898;

const browserConnections: WebSocket[] = [];
const cursorConnections: WebSocket[] = [];

// --- HTTP server ---

const STATIC_FILES: Record<string, { path: string; contentType: string }> = {
	"/browser-mcp-server.js": {
		path: join(__dirname, "browser-mcp-server.js"),
		contentType: "application/javascript",
	},
	"/browser-inject.js": {
		path: join(__dirname, "browser-inject.js"),
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

const httpServer = createServer(async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept",
	);

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	if (req.url === "/status") {
		res.writeHead(200, {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
		});
		res.end(
			JSON.stringify({
				browserCount: browserConnections.length,
				cursorCount: cursorConnections.length,
			}),
		);
		return;
	}

	const staticFile = STATIC_FILES[req.url ?? ""];
	if (staticFile) {
		try {
			const content = await fs.readFile(staticFile.path, "utf8");
			res.writeHead(200, { "Content-Type": staticFile.contentType });
			res.end(content);
		} catch {
			res.writeHead(500);
			res.end("Internal Server Error");
		}
		return;
	}

	res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
	res.end(buildIndexPage());
});

function buildIndexPage(): string {
	return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Browser MCP Relay Server</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
      pre { background-color: #f5f5f5; padding: 10px; border-radius: 5px; overflow-x: auto; }
      code { font-family: monospace; }
      .bookmarklet { display: inline-block; padding: 8px 12px; background-color: #f0f0f0; border-radius: 4px; text-decoration: none; color: #333; border: 1px solid #ccc; }
    </style>
  </head>
  <body>
    <h1>Browser MCP Relay Server</h1>
    <p>Server is running. Browser connections: <span id="bc">—</span> | Cursor connections: <span id="cc">—</span></p>

    <h2>Step 1: Inject MCP Client in Browser</h2>
    <p>Drag to bookmarks bar:</p>
    <a class="bookmarklet" href="javascript:(function(){var s=document.createElement('script');s.src='http://localhost:${PORT}/browser-inject.js';document.head.appendChild(s);})();">Browser MCP</a>
    <p>Or paste in browser console:</p>
    <pre><code>var s = document.createElement('script');
s.src = 'http://localhost:${PORT}/browser-inject.js';
document.head.appendChild(s);</code></pre>

    <h2>Step 2: Use MCP Tools in Cursor</h2>
    <pre><code>executeJS({ code: 'console.log(window.location.href)' })
getPageHTML()
getPageTitle()</code></pre>

    <script>
      setInterval(() => {
        fetch('/status').then(r => r.json()).then(d => {
          document.getElementById('bc').textContent = d.browserCount;
          document.getElementById('cc').textContent = d.cursorCount;
        }).catch(() => {});
      }, 5000);
    </script>
  </body>
</html>`;
}

// --- WebSocket server ---

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
	const url = new URL(req.url || "", `http://${req.headers.host}`);
	const path = url.pathname;

	if (path === "/browser") {
		browserConnections.push(ws);

		ws.send(
			JSON.stringify({
				type: "connection_status",
				status: "connected",
				message: "Connected to relay server",
			}),
		);

		ws.on("message", (data) => {
			for (const conn of cursorConnections) {
				conn.send(data.toString());
			}
		});

		ws.on("close", () => {
			const i = browserConnections.indexOf(ws);
			if (i !== -1) browserConnections.splice(i, 1);
		});
	} else if (path === "/cursor") {
		cursorConnections.push(ws);

		ws.on("message", (data) => {
			for (const conn of browserConnections) {
				conn.send(data.toString());
			}
		});

		ws.on("close", () => {
			const i = cursorConnections.indexOf(ws);
			if (i !== -1) cursorConnections.splice(i, 1);

			if (cursorConnections.length === 0) {
				setTimeout(() => cleanupAndExit(true), 2000);
			}
		});
	}
});

// --- Shared MCP tool helpers ---

type ToolResponse = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

function toolResult(text: string): ToolResponse {
	return { content: [{ type: "text", text }] };
}

function toolError(text: string): ToolResponse {
	return { content: [{ type: "text", text }], isError: true };
}

function noBrowserConnection(): ToolResponse {
	return toolError(
		"Error: No browser connections. Please inject the MCP client in the browser first.",
	);
}

type BrowserMessage = Record<string, unknown>;

function sendBrowserRequest(
	type: string,
	payload: Record<string, unknown> = {},
	timeoutMs = 5000,
): Promise<BrowserMessage> {
	return new Promise((resolve, reject) => {
		const requestId = randomUUID();
		const connection = browserConnections[0];
		let settled = false;

		function cleanup() {
			clearTimeout(timer);
			connection.removeListener("message", onMessage);
			connection.removeListener("close", onClose);
		}

		function settleResolve(value: BrowserMessage) {
			if (settled) return;
			settled = true;
			cleanup();
			resolve(value);
		}

		function settleReject(error: Error) {
			if (settled) return;
			settled = true;
			cleanup();
			reject(error);
		}

		const timer = setTimeout(
			() => settleReject(new Error("Request timed out. Browser did not respond.")),
			timeoutMs,
		);

		function onClose() {
			settleReject(new Error("Browser connection closed while waiting for response."));
		}

		function onMessage(data: Buffer | ArrayBuffer | Buffer[]) {
			let message: BrowserMessage;
			try {
				message = JSON.parse(data.toString()) as BrowserMessage;
			} catch {
				return;
			}
			if (message.requestId !== requestId) return;
			if (message.error) {
				settleReject(new Error(String(message.error)));
			} else {
				settleResolve(message);
			}
		}

		connection.on("message", onMessage);
		connection.on("close", onClose);
		connection.send(JSON.stringify({ type, requestId, ...payload }));
	});
}

// --- MCP Server ---

const transport = new StdioServerTransport();
const mcpServer = new McpServer({
	name: "Browser MCP",
	version: "1.0.0",
});

mcpServer.tool(
	"executeJS",
	"Execute JavaScript code in the current page context",
	{
		code: z
			.string()
			.describe("JavaScript code to execute in the browser page context"),
	},
	async ({ code }) => {
		if (browserConnections.length === 0) return noBrowserConnection();
		try {
			const msg = await sendBrowserRequest("execute_js", { code });
			const result = String(msg.result || "Execution successful, no return value");
			return toolResult(result);
		} catch (e) {
			return toolError(`Error: ${(e as Error).message}`);
		}
	},
);

mcpServer.tool(
	"getPageHTML",
	"Get HTML content of the current page",
	{},
	async () => {
		if (browserConnections.length === 0) return noBrowserConnection();
		try {
			const msg = await sendBrowserRequest("get_page_html");
			return toolResult(String(msg.html ?? ""));
		} catch (e) {
			return toolError(`Error: ${(e as Error).message}`);
		}
	},
);

mcpServer.tool(
	"getPageTitle",
	"Get title of the current page",
	{},
	async () => {
		if (browserConnections.length === 0) return noBrowserConnection();
		try {
			const msg = await sendBrowserRequest("get_page_title");
			return toolResult(String(msg.title ?? ""));
		} catch (e) {
			return toolError(`Error: ${(e as Error).message}`);
		}
	},
);

mcpServer.tool(
	"getElements",
	"Use CSS selector to get elements on the page",
	{ selector: z.string().describe("CSS selector") },
	async ({ selector }) => {
		if (browserConnections.length === 0) return noBrowserConnection();
		try {
			const msg = await sendBrowserRequest("get_elements", { selector });
			return toolResult(JSON.stringify(msg.elements, null, 2));
		} catch (e) {
			return toolError(`Error: ${(e as Error).message}`);
		}
	},
);

mcpServer.tool(
	"captureScreenshot",
	"Capture screenshot of the current page (using html2canvas)",
	{
		selector: z
			.string()
			.optional()
			.describe("Optional CSS selector for capturing a specific element"),
	},
	async ({ selector = "body" }) => {
		if (browserConnections.length === 0) return noBrowserConnection();
		try {
			const msg = await sendBrowserRequest(
				"capture_screenshot",
				{ selector },
				15000,
			);

			if (!msg.imageDataUrl) {
				return toolError("Error: No screenshot data received");
			}

			const dataUrlParts = String(msg.imageDataUrl).split(",");
			if (dataUrlParts.length !== 2 || !dataUrlParts[1]) {
				return toolError("Error: Screenshot data format is incorrect");
			}

			const homeDir = homedir();
			const saveDir = join(homeDir, "Downloads", "mcp-screenshots");
			mkdirSync(saveDir, { recursive: true });

			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const filePath = join(saveDir, `screenshot-${timestamp}.png`);
			writeFileSync(filePath, dataUrlParts[1], "base64");

			return toolResult(
				`Screenshot saved to: ${filePath}\n\nTip: for better results, specify a selector like captureScreenshot({selector: ".main-content"})`,
			);
		} catch (e) {
			return toolError(`Error: ${(e as Error).message}`);
		}
	},
);

mcpServer.tool("getPageURL", "Get URL of the current page", {}, async () => {
	if (browserConnections.length === 0) return noBrowserConnection();
	try {
		const msg = await sendBrowserRequest("get_page_url");
		return toolResult(String(msg.url ?? ""));
	} catch (e) {
		return toolError(`Error: ${(e as Error).message}`);
	}
});

mcpServer.tool(
	"clickElement",
	"Click element on the page",
	{ selector: z.string().describe("CSS selector of the element to click") },
	async ({ selector }) => {
		if (browserConnections.length === 0) return noBrowserConnection();
		try {
			const msg = await sendBrowserRequest("click_element", { selector });
			return toolResult(String(msg.message ?? "Element clicked successfully"));
		} catch (e) {
			return toolError(`Error: ${(e as Error).message}`);
		}
	},
);

mcpServer.tool(
	"inputText",
	"Enter text into input field",
	{
		selector: z.string().describe("CSS selector of the input field"),
		text: z.string().describe("Text to enter"),
	},
	async ({ selector, text }) => {
		if (browserConnections.length === 0) return noBrowserConnection();
		try {
			const msg = await sendBrowserRequest("input_text", { selector, text });
			return toolResult(String(msg.message ?? "Text entered successfully"));
		} catch (e) {
			return toolError(`Error: ${(e as Error).message}`);
		}
	},
);

// --- Process lifecycle ---

process.on("SIGINT", () => cleanupAndExit(true));
process.on("SIGTERM", () => cleanupAndExit(true));
process.on("uncaughtException", (error) => {
	console.error("[BCM] Uncaught exception:", error);
	cleanupAndExit(true);
});
process.on("unhandledRejection", (reason) => {
	console.error("[BCM] Unhandled Promise rejection:", reason);
});

httpServer.listen(PORT, () => {
	console.log(`[BCM] Server started, listening on port ${PORT}`);
});

mcpServer.connect(transport).catch((error: Error) => {
	console.error("[BCM] MCP server initialization failed:", error);
	cleanupAndExit(true);
});

function cleanupAndExit(shouldExit = true) {
	for (const conn of [...browserConnections, ...cursorConnections]) {
		try {
			conn.close();
		} catch {}
	}
	wss.close();
	httpServer.close(() => {
		if (shouldExit) process.exit(0);
	});
}
