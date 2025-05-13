/**
 * Browser MCP Relay Server
 *
 * This server is responsible for:
 * 1. Providing static file service, including browser-mcp-server.js and browser-inject.js
 * 2. Establishing WebSocket server to receive connections from browsers
 * 3. Establishing communication with the MCP server in the browser
 * 4. Communicating with Cursor via stdio (MCP protocol)
 */

// Import necessary modules
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Import MCP SDK
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { type WebSocket, WebSocketServer } from "ws";
import { z } from "zod";

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../..");

// Server configuration
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 7898;

// Store browser WebSocket connections
const browserConnections: WebSocket[] = [];
// Store Cursor WebSocket connections
const cursorConnections: WebSocket[] = [];

// Create HTTP server
const server = createServer((req, res) => {
	// Set CORS headers
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"Origin, X-Requested-With, Content-Type, Accept",
	);

	// Handle preflight requests
	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	// Handle status API requests
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

	// Handle static file requests
	if (req.url === "/browser-mcp-server.js") {
		res.writeHead(200, { "Content-Type": "application/javascript" });
		const filePath = join(__dirname, "browser-mcp-server.js");
		try {
			const content = readFileSync(filePath, "utf8");
			res.end(content);
		} catch (error) {
			console.error("[BCM] Error reading file:", error);
			res.writeHead(500);
			res.end("Internal Server Error");
		}
		return;
	}

	if (req.url === "/browser-inject.js") {
		res.writeHead(200, { "Content-Type": "application/javascript" });
		const filePath = join(__dirname, "browser-inject.js");
		try {
			const content = readFileSync(filePath, "utf8");
			res.end(content);
		} catch (error) {
			console.error("[BCM] Error reading file:", error);
			res.writeHead(500);
			res.end("Internal Server Error");
		}
		return;
	}

	// Serve client script file
	if (req.url === "/browser-console-mcp.js") {
		res.writeHead(200, { "Content-Type": "application/javascript" });
		const filePath = join(rootDir, "dist/client/browser-console-mcp.js");
		try {
			const content = readFileSync(filePath, "utf8");
			res.end(content);
		} catch (error) {
			console.error("[BCM] Error reading file:", error);
			res.writeHead(500);
			res.end("Internal Server Error");
		}
		return;
	}

	// Serve client script map file
	if (req.url === "/browser-console-mcp.js.map") {
		res.writeHead(200, { "Content-Type": "application/json" });
		const filePath = join(rootDir, "dist/client/browser-console-mcp.js.map");
		try {
			const content = readFileSync(filePath, "utf8");
			res.end(content);
		} catch (error) {
			console.error("[BCM] Error reading file:", error);
			res.writeHead(500);
			res.end("Internal Server Error");
		}
		return;
	}

	// Default response - provide usage instructions
	res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
	res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Browser MCP Relay Server</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          pre {
            background-color: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
          code {
            font-family: monospace;
          }
          .bookmarklet {
            display: inline-block;
            padding: 8px 12px;
            background-color: #f0f0f0;
            border-radius: 4px;
            text-decoration: none;
            color: #333;
            border: 1px solid #ccc;
          }
          .button {
            display: inline-block;
            padding: 8px 12px;
            background-color: #4CAF50;
            color: white;
            border-radius: 4px;
            text-decoration: none;
            margin-right: 10px;
          }
          .button:hover {
            background-color: #45a049;
          }
        </style>
      </head>
      <body>
        <h1>Browser MCP Relay Server</h1>
        <p>Server is running. You can use it as follows:</p>
        
        <h2>Usage</h2>
        
        <h2>Step 1: Inject MCP Client in Browser</h2>
        <p>Drag the following link to your bookmarks bar:</p>
        <a class="bookmarklet" href="javascript:(function(){var s=document.createElement('script');s.src='http://localhost:${PORT}/browser-inject.js';document.head.appendChild(s);})();">Browser MCP</a>
        
        <p>Or paste the following code in your browser console:</p>
        <pre><code>var s = document.createElement('script');
s.src = 'http://localhost:${PORT}/browser-inject.js';
document.head.appendChild(s);</code></pre>

        <h2>Step 2: Use MCP Tools in Cursor</h2>
        <p>Now you can use MCP features in Cursor to execute browser commands, such as:</p>
        <pre><code>// Execute JavaScript code in the browser
executeJS({ code: 'console.log(window.location.href)' })

// Get page HTML
getPageHTML()

// Get page title
getPageTitle()</code></pre>

        <h2>Connection Status</h2>
        <p>Browser connection count: <span id="browser-count">0</span></p>
        <p>Cursor connection count: <span id="cursor-count">0</span></p>
        
        <script>
          // Periodically update connection status
          setInterval(() => {
            fetch('/status')
              .then(res => res.json())
              .then(data => {
                document.getElementById('browser-count').textContent = data.browserCount;
                document.getElementById('cursor-count').textContent = data.cursorCount;
              })
              .catch(err => {
                console.error('Failed to get status:', err);
                // Display connection error if there's an error
                document.getElementById('browser-count').textContent = 'Connection error';
                document.getElementById('cursor-count').textContent = 'Connection error';
              });
          }, 5000);
        </script>
      </body>
    </html>
  `);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on("connection", (ws, req) => {
	// Determine connection type based on URL path
	const url = new URL(req.url || "", `http://${req.headers.host}`);
	const path = url.pathname;

	if (path === "/browser") {
		// Browser connection
		browserConnections.push(ws);

		// Send connection status message
		ws.send(
			JSON.stringify({
				type: "connection_status",
				status: "connected",
				message: "Connected to relay server",
			}),
		);

		// Handle browser messages
		ws.on("message", (data) => {
			try {
				// Forward message to Cursor
				if (cursorConnections.length > 0) {
					for (const conn of cursorConnections) {
						conn.send(data.toString());
					}
				}
			} catch (error) {
				console.error("[BCM] Error parsing browser message:", error);
			}
		});

		// Handle connection closure
		ws.on("close", () => {
			console.log("[BCM] Browser connection closed");
			const index = browserConnections.indexOf(ws);
			if (index !== -1) {
				browserConnections.splice(index, 1);
			}
		});
	} else if (path === "/cursor") {
		// Cursor connection
		console.log("[BCM] New Cursor connection");
		cursorConnections.push(ws);

		// Handle Cursor messages
		ws.on("message", (data) => {
			try {
				const message = JSON.parse(data.toString());

				// Forward message to browser
				if (browserConnections.length > 0) {
					for (const conn of browserConnections) {
						conn.send(data.toString());
					}
				}
			} catch (error) {
				console.error("[BCM] Error parsing Cursor message:", error);
			}
		});

		// Handle connection closure
		ws.on("close", () => {
			console.log("[BCM] Cursor connection closed");
			const index = cursorConnections.indexOf(ws);
			if (index !== -1) {
				cursorConnections.splice(index, 1);
			}
		});
	}
});

// Create MCP server
const transport = new StdioServerTransport();
// Use more standard MCP initialization method
// @ts-ignore - Type definition issue, we need to use compatible way
const mcpServer = new McpServer({
	name: "Browser MCP",
	version: "1.0.0",
	transport,
});

// Register tool - Use more standard way
// @ts-ignore - Type definition issue, we need to use compatible way
mcpServer.tool(
	"executeJS",
	"Execute JavaScript code in the current page context",
	{
		code: z
			.string()
			.describe("Execute JavaScript code in the current page context"),
	},
	async (params) => {
		// In MCP SDK 1.5.0, parameters are directly passed as the first parameter
		// @ts-ignore - Ignore type error, params should contain code attribute
		const code = params?.code || "";

		// Check if there are browser connections
		if (browserConnections.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "Error: No browser connections. Please inject MCP server in the browser first.",
					},
				],
				isError: true,
			};
		}

		// Create a Promise to wait for browser response
		return new Promise((resolve) => {
			// Create request ID
			const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

			// Create timeout handling
			const timeout = setTimeout(() => {
				resolve({
					content: [
						{
							type: "text",
							text: "Error: Request timed out. Browser did not respond.",
						},
					],
					isError: true,
				});
			}, 5000);

			// Set one-time message handling function
			const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]) => {
				try {
					const dataStr = data.toString();
					// Check if message starts with "[Browser MC", if so, don't try to parse as JSON
					if (dataStr.startsWith("[Browser MC")) {
						return; // This is a log message, no need to parse as JSON
					}

					const message = JSON.parse(dataStr);

					// Check if this is the corresponding response
					if (message.requestId === requestId) {
						// Clear timeout
						clearTimeout(timeout);

						// Remove message handler
						browserConnections[0].removeListener("message", messageHandler);

						// Return result
						if (message.error) {
							resolve({
								content: [
									{
										type: "text",
										text: `Error: ${message.error}`,
									},
								],
								isError: true,
							});
						} else {
							// Ensure return value is string
							let resultText =
								typeof message.result === "string"
									? message.result
									: String(message.result);

							if (!resultText) {
								resultText = "Execution successful, no return value";
							}

							resolve({
								content: [
									{
										type: "text",
										text: resultText,
									},
								],
							});
						}
					}
				} catch (error) {
					// Log parsing error, but don't interrupt the flow
					console.error(
						"[BCM] Message parsing error:",
						error,
						"Raw data:",
						data.toString().substring(0, 100),
					);
				}
			};

			// Add message handler
			browserConnections[0].on("message", messageHandler);

			// Send request to browser
			browserConnections[0].send(
				JSON.stringify({
					type: "execute_js",
					requestId,
					code,
				}),
			);
		});
	},
);

// @ts-ignore - Type definition issue, we need to use compatible way
mcpServer.tool(
	"getPageHTML",
	"Get HTML content of the current page",
	async () => {
		// Check if there are browser connections
		if (browserConnections.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "Error: No browser connections. Please inject MCP server in the browser first.",
					},
				],
				isError: true,
			};
		}

		// Create a Promise to wait for browser response
		return new Promise((resolve) => {
			// Create request ID
			const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

			// Create timeout handling
			const timeout = setTimeout(() => {
				resolve({
					content: [
						{
							type: "text",
							text: "Error: Request timed out. Browser did not respond.",
						},
					],
					isError: true,
				});
			}, 5000);

			// Set one-time message handling function
			const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]) => {
				try {
					const dataStr = data.toString();
					// Check if message starts with "[Browser MC", if so, don't try to parse as JSON
					if (dataStr.startsWith("[Browser MC")) {
						return; // This is a log message, no need to parse as JSON
					}

					const message = JSON.parse(dataStr);

					// Check if this is the corresponding response
					if (message.requestId === requestId) {
						// Clear timeout
						clearTimeout(timeout);

						// Remove message handling function
						browserConnections[0].removeListener("message", messageHandler);

						// Return result
						if (message.error) {
							resolve({
								content: [
									{
										type: "text",
										text: `Error: ${message.error}`,
									},
								],
								isError: true,
							});
						} else {
							resolve({
								content: [
									{
										type: "text",
										text: message.html,
									},
								],
							});
						}
					}
				} catch (error) {
					// Log parsing error, but don't interrupt the flow
					console.error(
						"[BCM] Message parsing error:",
						error,
						"Raw data:",
						data.toString().substring(0, 100),
					);
				}
			};

			// Add message handler
			browserConnections[0].on("message", messageHandler);

			// Send request to browser
			browserConnections[0].send(
				JSON.stringify({
					type: "get_page_html",
					requestId,
				}),
			);
		});
	},
);

// @ts-ignore - Type definition issue, we need to use compatible way
mcpServer.tool("getPageTitle", "Get title of the current page", async () => {
	// Check if there are browser connections
	if (browserConnections.length === 0) {
		return {
			content: [
				{
					type: "text",
					text: "Error: No browser connections. Please inject MCP server in the browser first.",
				},
			],
			isError: true,
		};
	}

	// Create a Promise to wait for browser response
	return new Promise((resolve) => {
		// Create request ID
		const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

		// Create timeout handling
		const timeout = setTimeout(() => {
			resolve({
				content: [
					{
						type: "text",
						text: "Error: Request timed out. Browser did not respond.",
					},
				],
				isError: true,
			});
		}, 5000);

		// Set one-time message handling function
		const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]) => {
			try {
				const dataStr = data.toString();
				// Check if message starts with "[Browser MC", if so, don't try to parse as JSON
				if (dataStr.startsWith("[Browser MC")) {
					return; // This is a log message, no need to parse as JSON
				}

				const message = JSON.parse(dataStr);

				// Check if this is the corresponding response
				if (message.requestId === requestId) {
					// Clear timeout
					clearTimeout(timeout);

					// Remove message handler
					browserConnections[0].removeListener("message", messageHandler);

					// Return result
					if (message.error) {
						resolve({
							content: [
								{
									type: "text",
									text: `Error: ${message.error}`,
								},
							],
							isError: true,
						});
					} else {
						resolve({
							content: [
								{
									type: "text",
									text: message.title,
								},
							],
						});
					}
				}
			} catch (error) {
				// Log parsing error, but don't interrupt the flow
				console.error(
					"[BCM] Message parsing error:",
					error,
					"Raw data:",
					data.toString().substring(0, 100),
				);
			}
		};

		// Add message handler
		browserConnections[0].on("message", messageHandler);

		// Send request to browser
		browserConnections[0].send(
			JSON.stringify({
				type: "get_page_title",
				requestId,
			}),
		);
	});
});

// @ts-ignore - Type definition issue, we need to use compatible way
mcpServer.tool(
	"getElements",
	"Use CSS selector to get elements on the page",
	{ selector: z.string().describe("CSS selector") },
	async (params) => {
		// Check parameters
		const selector = params?.selector;
		if (!selector) {
			return {
				content: [
					{
						type: "text",
						text: "Error: Missing required parameter 'selector'",
					},
				],
				isError: true,
			};
		}

		// Check if there are browser connections
		if (browserConnections.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "Error: No browser connections. Please inject MCP server in the browser first.",
					},
				],
				isError: true,
			};
		}

		// Create a Promise to wait for browser response
		return new Promise((resolve) => {
			// Create request ID
			const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

			// Create timeout handling
			const timeout = setTimeout(() => {
				resolve({
					content: [
						{
							type: "text",
							text: "Error: Request timed out. Browser did not respond.",
						},
					],
					isError: true,
				});
			}, 5000);

			// Set one-time message handling function
			const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]) => {
				try {
					const dataStr = data.toString();
					// Check if message starts with "[Browser MC", if so, don't try to parse as JSON
					if (dataStr.startsWith("[Browser MC")) {
						return; // This is a log message, no need to parse as JSON
					}

					const message = JSON.parse(dataStr);

					// Check if it's the corresponding response
					if (message.requestId === requestId) {
						// Clear timeout
						clearTimeout(timeout);

						// Remove message handling function
						browserConnections[0].removeListener("message", messageHandler);

						// Return result
						if (message.error) {
							resolve({
								content: [
									{
										type: "text",
										text: `Error: ${message.error}`,
									},
								],
								isError: true,
							});
						} else {
							// Format elements information
							const elementsInfo = JSON.stringify(message.elements, null, 2);
							resolve({
								content: [
									{
										type: "text",
										text: elementsInfo,
									},
								],
							});
						}
					}
				} catch (error) {
					// Log parsing error, but don't interrupt the flow
					console.error(
						"[BCM] Message parsing error:",
						error,
						"Raw data:",
						data.toString().substring(0, 100),
					);
				}
			};

			// Add message handler
			browserConnections[0].on("message", messageHandler);

			// Send request to browser
			browserConnections[0].send(
				JSON.stringify({
					type: "get_elements",
					requestId,
					selector,
				}),
			);
		});
	},
);

// @ts-ignore - Type definition issue, we need to use compatible way
mcpServer.tool(
	"captureScreenshot",
	"Capture screenshot of the current page (using html2canvas)",
	{
		selector: z
			.string()
			.optional()
			.describe("Optional CSS selector, for capturing specific elements"),
	},
	async (params) => {
		// Get parameters
		const selector = params?.selector || "body";

		// Check if there are browser connections
		if (browserConnections.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "Error: No browser connections. Please inject MCP server in the browser first.",
					},
				],
				isError: true,
			};
		}

		// Create a Promise to wait for browser response
		return new Promise((resolve) => {
			// Create request ID
			const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

			// Create timeout handling
			const timeout = setTimeout(() => {
				resolve({
					content: [
						{
							type: "text",
							text: "Error: Request timed out. Browser did not respond.",
						},
					],
					isError: true,
				});
			}, 15000); // Increase screenshot timeout to 15 seconds, as screenshots may take longer

			// Set one-time message handling function
			const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]) => {
				try {
					const dataStr = data.toString();
					// Check if message starts with "[Browser MC", if so, don't try to parse as JSON
					if (dataStr.startsWith("[Browser MC")) {
						return; // This is a log message, no need to parse as JSON
					}

					const message = JSON.parse(dataStr);

					// Check if it's the corresponding response
					if (message.requestId === requestId) {
						// Clear timeout
						clearTimeout(timeout);

						// Remove message handling function
						browserConnections[0].removeListener("message", messageHandler);

						// Return result
						if (message.error) {
							resolve({
								content: [
									{
										type: "text",
										text: `Error: ${message.error}`,
									},
								],
								isError: true,
							});
						} else if (!message.imageDataUrl) {
							resolve({
								content: [
									{
										type: "text",
										text: "Error: No screenshot data received",
									},
								],
								isError: true,
							});
						} else {
							try {
								// Ensure data URL format is correct
								const dataUrlParts = message.imageDataUrl.split(",");
								if (dataUrlParts.length !== 2) {
									throw new Error("Screenshot data format is incorrect");
								}

								const base64Data = dataUrlParts[1];

								if (!base64Data) {
									throw new Error("Screenshot data format is incorrect");
								}

								// Get user home directory
								const homeDir = homedir();

								// Create save directory
								const saveDir = join(homeDir, "Downloads", "mcp-screenshots");
								try {
									mkdirSync(saveDir, { recursive: true });
								} catch (err) {
									console.error(
										"[BCM] Failed to create screenshots directory:",
										err,
									);
								}

								// Generate filename
								const timestamp = new Date()
									.toISOString()
									.replace(/[:.]/g, "-");
								const filename = `screenshot-${timestamp}.png`;
								const filePath = join(saveDir, filename);

								// Save file
								try {
									writeFileSync(filePath, base64Data, "base64");
									console.log(`[BCM] Screenshot saved to: ${filePath}`);

									// Return success message and file path
									resolve({
										content: [
											{
												type: "text",
												text: `Screenshot saved successfully to: ${filePath}\n\nNote: If the screenshot has white space issues, you can try specifying a specific element selector, such as: captureScreenshot({selector: ".main-content"})`,
											},
										],
									});
								} catch (err) {
									console.error("[BCM] Failed to save screenshot:", err);
									resolve({
										content: [
											{
												type: "text",
												text: `Failed to save screenshot: ${err instanceof Error ? err.message : String(err)}`,
											},
										],
										isError: true,
									});
								}
							} catch (error: unknown) {
								const errorMessage =
									error instanceof Error ? error.message : String(error);
								resolve({
									content: [
										{
											type: "text",
											text: `Error: Failed to process screenshot data - ${errorMessage}`,
										},
									],
									isError: true,
								});
							}
						}
					}
				} catch (error) {
					console.error("[BCM] Error parsing screenshot response:", error);
					// Continue listening, do not remove listener on parsing error
				}
			};

			// Add message handler
			browserConnections[0].on("message", messageHandler);

			// Send request to browser
			console.log(
				`[BCM] Sending screenshot request, ID: ${requestId}, selector: ${selector}`,
			);
			browserConnections[0].send(
				JSON.stringify({
					type: "capture_screenshot",
					requestId,
					selector,
				}),
			);
		});
	},
);

// @ts-ignore - Type definition issue, we need to use compatible way
mcpServer.tool("getPageURL", "Get URL of the current page", async () => {
	// Check if there are browser connections
	if (browserConnections.length === 0) {
		return {
			content: [
				{
					type: "text",
					text: "Error: No browser connections. Please inject MCP server in the browser first.",
				},
			],
			isError: true,
		};
	}

	// Create a Promise to wait for browser response
	return new Promise((resolve) => {
		// Create request ID
		const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

		// Create timeout handling
		const timeout = setTimeout(() => {
			resolve({
				content: [
					{
						type: "text",
						text: "Error: Request timed out. Browser did not respond.",
					},
				],
				isError: true,
			});
		}, 5000);

		// Set one-time message handling function
		const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]) => {
			try {
				const dataStr = data.toString();
				// Check if message starts with "[Browser MC", if so, don't try to parse as JSON
				if (dataStr.startsWith("[Browser MC")) {
					return; // This is a log message, no need to parse as JSON
				}

				const message = JSON.parse(dataStr);

				// Check if this is the corresponding response
				if (message.requestId === requestId) {
					// Clear timeout
					clearTimeout(timeout);

					// Remove message handling function
					browserConnections[0].removeListener("message", messageHandler);

					// Return result
					if (message.error) {
						resolve({
							content: [
								{
									type: "text",
									text: `Error: ${message.error}`,
								},
							],
							isError: true,
						});
					} else {
						resolve({
							content: [
								{
									type: "text",
									text: message.url,
								},
							],
						});
					}
				}
			} catch (error) {
				// Log parsing error, but don't interrupt the flow
				console.error(
					"[BCM] Message parsing error:",
					error,
					"Raw data:",
					data.toString().substring(0, 100),
				);
			}
		};

		// Add message handler
		browserConnections[0].on("message", messageHandler);

		// Send request to browser
		browserConnections[0].send(
			JSON.stringify({
				type: "get_page_url",
				requestId,
			}),
		);
	});
});

// @ts-ignore - Type definition issue, we need to use compatible way
mcpServer.tool(
	"clickElement",
	"Click element on the page",
	{ selector: z.string().describe("CSS selector of the element to click") },
	async (params) => {
		// Check parameters
		const selector = params?.selector;
		if (!selector) {
			return {
				content: [
					{
						type: "text",
						text: "Error: Missing required parameter 'selector'",
					},
				],
				isError: true,
			};
		}

		// Check if there are browser connections
		if (browserConnections.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "Error: No browser connections. Please inject MCP server in the browser first.",
					},
				],
				isError: true,
			};
		}

		// Create a Promise to wait for browser response
		return new Promise((resolve) => {
			// Create request ID
			const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

			// Create timeout handling
			const timeout = setTimeout(() => {
				resolve({
					content: [
						{
							type: "text",
							text: "Error: Request timed out. Browser did not respond.",
						},
					],
					isError: true,
				});
			}, 5000);

			// Set one-time message handling function
			const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]) => {
				try {
					const dataStr = data.toString();
					// Check if message starts with "[Browser MC", if so, don't try to parse as JSON
					if (dataStr.startsWith("[Browser MC")) {
						return; // This is a log message, no need to parse as JSON
					}

					const message = JSON.parse(dataStr);

					// Check if it's the corresponding response
					if (message.requestId === requestId) {
						// Clear timeout
						clearTimeout(timeout);

						// Remove message handling function
						browserConnections[0].removeListener("message", messageHandler);

						// Return result
						if (message.error) {
							resolve({
								content: [
									{
										type: "text",
										text: `Error: ${message.error}`,
									},
								],
								isError: true,
							});
						} else {
							resolve({
								content: [
									{
										type: "text",
										text: message.message || "Element clicked successfully",
									},
								],
							});
						}
					}
				} catch (error) {
					// Log parsing error, but don't interrupt the flow
					console.error(
						"[BCM] Message parsing error:",
						error,
						"Raw data:",
						data.toString().substring(0, 100),
					);
				}
			};

			// Add message handler
			browserConnections[0].on("message", messageHandler);

			// Send request to browser
			browserConnections[0].send(
				JSON.stringify({
					type: "click_element",
					requestId,
					selector,
				}),
			);
		});
	},
);

// @ts-ignore - Type definition issue, we need to use compatible way
mcpServer.tool(
	"inputText",
	"Enter text into input field",
	{
		selector: z.string().describe("CSS selector of the input field"),
		text: z.string().describe("Text to enter"),
	},
	async (params) => {
		// Check parameters
		const selector = params?.selector;
		const text = params?.text;
		if (!selector || text === undefined) {
			return {
				content: [
					{
						type: "text",
						text: "Error: Missing required parameters 'selector' or 'text'",
					},
				],
				isError: true,
			};
		}

		// Check if there are browser connections
		if (browserConnections.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "Error: No browser connections. Please inject MCP server in the browser first.",
					},
				],
				isError: true,
			};
		}

		// Create a Promise to wait for browser response
		return new Promise((resolve) => {
			// Create request ID
			const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

			// Create timeout handling
			const timeout = setTimeout(() => {
				resolve({
					content: [
						{
							type: "text",
							text: "Error: Request timed out. Browser did not respond.",
						},
					],
					isError: true,
				});
			}, 5000);

			// Set one-time message handling function
			const messageHandler = (data: Buffer | ArrayBuffer | Buffer[]) => {
				try {
					const dataStr = data.toString();
					// Check if message starts with "[Browser MC", if so, don't try to parse as JSON
					if (dataStr.startsWith("[Browser MC")) {
						return; // This is a log message, no need to parse as JSON
					}

					const message = JSON.parse(dataStr);

					// Check if it's the corresponding response
					if (message.requestId === requestId) {
						// Clear timeout
						clearTimeout(timeout);

						// Remove message handling function
						browserConnections[0].removeListener("message", messageHandler);

						// Return result
						if (message.error) {
							resolve({
								content: [
									{
										type: "text",
										text: `Error: ${message.error}`,
									},
								],
								isError: true,
							});
						} else {
							resolve({
								content: [
									{
										type: "text",
										text: message.message || "Text entered successfully",
									},
								],
							});
						}
					}
				} catch (error) {
					// Log parsing error, but don't interrupt the flow
					console.error(
						"[BCM] Message parsing error:",
						error,
						"Raw data:",
						data.toString().substring(0, 100),
					);
				}
			};

			// Add message handler
			browserConnections[0].on("message", messageHandler);

			// Send request to browser
			browserConnections[0].send(
				JSON.stringify({
					type: "input_text",
					requestId,
					selector,
					text,
				}),
			);
		});
	},
);

// Handle process signals
process.on("SIGINT", () => {
	cleanupAndExit(true);
});

process.on("SIGTERM", () => {
	cleanupAndExit(true);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
	console.error("[BCM] Uncaught exception:", error);
	cleanupAndExit(true);
});

process.on("unhandledRejection", (reason) => {
	console.error("[BCM] Unhandled Promise rejection:", reason);
	// Do not exit, just record
});

// Start server
server.listen(PORT, () => {
	console.log(`[BCM] Server started, listening on port ${PORT}`);
});

// Initialize MCP server
// @ts-ignore - Use old version MCP SDK 1.5.0 API
mcpServer.connect(transport).catch((error: Error) => {
	console.error("[BCM] MCP server initialization failed:", error);
	cleanupAndExit(true);
});

/**
 * Clean up resources and exit
 */
function cleanupAndExit(shouldExit = true) {
	// Close all WebSocket connections
	for (const conn of browserConnections) {
		try {
			conn.close();
		} catch (error) {
			console.error("[BCM] Error closing browser connection:", error);
		}
	}

	for (const conn of cursorConnections) {
		try {
			conn.close();
		} catch (error) {
			console.error("[BCM] Error closing Cursor connection:", error);
		}
	}

	// Close WebSocket server
	wss.close();

	// Close HTTP server
	server.close(() => {
		console.log("[BCM] HTTP server closed");
		if (shouldExit) {
			process.exit(0);
		}
	});
}
