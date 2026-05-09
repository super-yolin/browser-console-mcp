import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DaemonClient } from "./daemon-client";
import type { BrowserCommandType, RpcResponse } from "../shared/protocol";

type ToolResponse = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

const daemon = new DaemonClient();
const transport = new StdioServerTransport();
const mcpServer = new McpServer({
	name: "Browser MCP",
	version: "1.2.0",
});

const sessionIdSchema = z
	.string()
	.optional()
	.describe("Optional browser session ID. If omitted, the active session is used.");

function toolResult(text: string): ToolResponse {
	return { content: [{ type: "text", text }] };
}

function toolError(text: string): ToolResponse {
	return { content: [{ type: "text", text }], isError: true };
}

function formatRpcResponse(response: RpcResponse, pick: (result: Record<string, unknown>) => string): ToolResponse {
	if (!response.ok) {
		return toolError(`Error: ${response.error?.message ?? "Browser request failed"}`);
	}
	const result = response.result ?? {};
	const suffix = response.session
		? `\n\nSession: ${response.session.sessionId}\nURL: ${response.session.url}`
		: "";
	return toolResult(`${pick(result)}${suffix}`);
}

async function callBrowser(
	type: BrowserCommandType,
	payload: Record<string, unknown> = {},
	sessionId?: string,
	timeoutMs = 5000,
): Promise<RpcResponse> {
	return daemon.sendBrowserRequest({ type, payload, sessionId, timeoutMs });
}

mcpServer.tool(
	"executeJS",
	"Execute JavaScript code in the current page context",
	{
		code: z.string().describe("JavaScript code to execute in the browser page context"),
		sessionId: sessionIdSchema,
	},
	async ({ code, sessionId }) => {
		try {
			const response = await callBrowser("execute_js", { code }, sessionId);
			return formatRpcResponse(response, (result) =>
				String(result.result || "Execution successful, no return value"),
			);
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool(
	"getPageHTML",
	"Get HTML content of the current page",
	{ sessionId: sessionIdSchema },
	async ({ sessionId }) => {
		try {
			const response = await callBrowser("get_page_html", {}, sessionId);
			return formatRpcResponse(response, (result) => String(result.html ?? ""));
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool(
	"getPageTitle",
	"Get title of the current page",
	{ sessionId: sessionIdSchema },
	async ({ sessionId }) => {
		try {
			const response = await callBrowser("get_page_title", {}, sessionId);
			return formatRpcResponse(response, (result) => String(result.title ?? ""));
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool(
	"getElements",
	"Use CSS selector to get elements on the page",
	{
		selector: z.string().describe("CSS selector"),
		sessionId: sessionIdSchema,
	},
	async ({ selector, sessionId }) => {
		try {
			const response = await callBrowser("get_elements", { selector }, sessionId);
			return formatRpcResponse(response, (result) =>
				JSON.stringify(result.elements ?? [], null, 2),
			);
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
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
		sessionId: sessionIdSchema,
	},
	async ({ selector = "body", sessionId }) => {
		try {
			const response = await callBrowser(
				"capture_screenshot",
				{ selector },
				sessionId,
				15000,
			);
			if (!response.ok) {
				return toolError(`Error: ${response.error?.message ?? "Screenshot failed"}`);
			}

			const imageDataUrl = String(response.result?.imageDataUrl ?? "");
			const dataUrlParts = imageDataUrl.split(",");
			if (dataUrlParts.length !== 2 || !dataUrlParts[1]) {
				return toolError("Error: Screenshot data format is incorrect");
			}

			const saveDir = join(homedir(), "Downloads", "mcp-screenshots");
			mkdirSync(saveDir, { recursive: true });
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const filePath = join(saveDir, `screenshot-${timestamp}.png`);
			writeFileSync(filePath, dataUrlParts[1], "base64");

			return toolResult(
				`Screenshot saved to: ${filePath}\n\nSession: ${response.session?.sessionId ?? "unknown"}\nURL: ${response.session?.url ?? "unknown"}`,
			);
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool(
	"getPageURL",
	"Get URL of the current page",
	{ sessionId: sessionIdSchema },
	async ({ sessionId }) => {
		try {
			const response = await callBrowser("get_page_url", {}, sessionId);
			return formatRpcResponse(response, (result) => String(result.url ?? ""));
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool(
	"clickElement",
	"Click element on the page",
	{
		selector: z.string().describe("CSS selector of the element to click"),
		sessionId: sessionIdSchema,
	},
	async ({ selector, sessionId }) => {
		try {
			const response = await callBrowser("click_element", { selector }, sessionId);
			return formatRpcResponse(response, (result) =>
				String(result.message ?? "Element clicked successfully"),
			);
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool(
	"inputText",
	"Enter text into input field",
	{
		selector: z.string().describe("CSS selector of the input field"),
		text: z.string().describe("Text to enter"),
		sessionId: sessionIdSchema,
	},
	async ({ selector, text, sessionId }) => {
		try {
			const response = await callBrowser("input_text", { selector, text }, sessionId);
			return formatRpcResponse(response, (result) =>
				String(result.message ?? "Text entered successfully"),
			);
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool(
	"getConsoleLogs",
	"Get console logs captured after the page agent was installed",
	{
		level: z
			.enum(["log", "info", "warn", "error", "debug"])
			.optional()
			.describe("Optional console level filter"),
		limit: z.number().optional().describe("Maximum logs to return, default 50"),
		sessionId: sessionIdSchema,
	},
	async ({ level, limit, sessionId }) => {
		try {
			const response = await callBrowser(
				"get_console_logs",
				{ level, limit },
				sessionId,
			);
			return formatRpcResponse(response, (result) =>
				JSON.stringify(result.logs ?? [], null, 2),
			);
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool(
	"getNetworkRequests",
	"Get fetch/XHR requests captured after the page agent was installed",
	{
		limit: z.number().optional().describe("Maximum requests to return, default 50"),
		includeResources: z
			.boolean()
			.optional()
			.describe("Also include browser performance resource entries"),
		sessionId: sessionIdSchema,
	},
	async ({ limit, includeResources = false, sessionId }) => {
		try {
			const response = await callBrowser(
				"get_network_requests",
				{ limit, includeResources },
				sessionId,
			);
			return formatRpcResponse(response, (result) =>
				JSON.stringify(result.requests ?? [], null, 2),
			);
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool(
	"clearBrowserDiagnostics",
	"Clear captured console logs and network requests for the active browser session",
	{ sessionId: sessionIdSchema },
	async ({ sessionId }) => {
		try {
			const response = await callBrowser("clear_browser_diagnostics", {}, sessionId);
			return formatRpcResponse(response, (result) =>
				JSON.stringify(result.cleared ?? {}, null, 2),
			);
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

mcpServer.tool("listBrowserSessions", "List connected browser sessions", {}, async () => {
	try {
		const sessions = await daemon.listSessions();
		return toolResult(JSON.stringify(sessions, null, 2));
	} catch (error) {
		return toolError(`Error: ${(error as Error).message}`);
	}
});

mcpServer.tool(
	"selectBrowserSession",
	"Select the active browser session for subsequent tools",
	{ sessionId: z.string().describe("Browser session ID returned by listBrowserSessions") },
	async ({ sessionId }) => {
		try {
			const result = await daemon.selectSession(sessionId);
			return toolResult(JSON.stringify(result, null, 2));
		} catch (error) {
			return toolError(`Error: ${(error as Error).message}`);
		}
	},
);

daemon
	.ensureRunning()
	.then(() => mcpServer.connect(transport))
	.catch((error: Error) => {
		console.error("[BCM Adapter] MCP server initialization failed:", error);
		process.exit(1);
	});
