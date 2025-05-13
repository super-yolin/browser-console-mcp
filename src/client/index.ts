/**
 * Browser Console MCP Client
 *
 * This client runs in the browser console and communicates with the MCP server
 */

interface MCPMessage {
	type: string;
	payload?: Record<string, unknown>;
	requestId?: string;
	code?: string;
	message?: string;
	selector?: string;
	text?: string;
}

interface MCPConsole {
	exec: (command: string) => string;
	disconnect: () => string;
	reconnect: () => string;
	help: () => string;
}

// html2canvas options type
interface Html2CanvasOptions {
	allowTaint?: boolean;
	useCORS?: boolean;
	logging?: boolean;
	scale?: number;
	backgroundColor?: string | null;
	removeContainer?: boolean;
	scrollX?: number;
	scrollY?: number;
	windowWidth?: number;
	windowHeight?: number;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	[key: string]: boolean | number | string | undefined | null;
}

// Extend global Window interface
declare global {
	interface Window {
		mcp: MCPConsole;
	}

	interface WindowWithHtml2Canvas extends Window {
		html2canvas?: (
			element: HTMLElement,
			options?: Html2CanvasOptions,
		) => Promise<HTMLCanvasElement>;
	}
}

class BrowserConsoleMCP {
	private ws: WebSocket | null = null;
	private serverUrl: string;
	private connected = false;
	private commandHistory: string[] = [];
	private historyIndex = -1;

	constructor(serverUrl = "ws://localhost:7898/browser") {
		this.serverUrl = serverUrl;
	}

	/**
	 * Connect to MCP server
	 */
	connect(): void {
		try {
			// First load html2canvas
			this.loadHtml2Canvas()
				.then(() => {
					this.ws = new WebSocket(this.serverUrl);

					this.ws.onopen = () => {
						this.connected = true;
						console.info("%c[MCP Client] Connected to server", "color: green");
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
						console.info(
							"%c[MCP Client] Disconnected from server",
							"color: orange",
						);
					};

					this.ws.onerror = (error) => {
						console.error("[MCP Client] WebSocket error:", error);
					};
				})
				.catch((error) => {
					console.error("[MCP Client] Failed to load html2canvas:", error);
				});
		} catch (error) {
			console.error("[MCP Client] Connection error:", error);
		}
	}

	/**
	 * Load html2canvas library
	 */
	private loadHtml2Canvas(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			if (
				typeof (window as WindowWithHtml2Canvas).html2canvas !== "undefined"
			) {
				console.info("[MCP Client] html2canvas already loaded");
				resolve(true);
				return;
			}

			console.info("[MCP Client] Loading html2canvas...");

			// Prioritize loading html2canvas from CDN
			const script = document.createElement("script");
			script.src = "https://html2canvas.hertzen.com/dist/html2canvas.min.js";
			script.onload = () => {
				console.info("[MCP Client] html2canvas loaded from CDN");
				resolve(true);
			};
			script.onerror = () => {
				// If CDN fails, try local path
				console.info("[MCP Client] Trying local path for html2canvas...");
				const localScript = document.createElement("script");
				localScript.src = "/html2canvas.min.js";
				localScript.onload = () => {
					console.info("[MCP Client] html2canvas loaded from local path");
					resolve(true);
				};
				localScript.onerror = (err) => {
					// Try using unpkg CDN
					console.info("[MCP Client] Trying unpkg CDN for html2canvas...");
					const unpkgScript = document.createElement("script");
					unpkgScript.src =
						"https://unpkg.com/html2canvas/dist/html2canvas.min.js";
					unpkgScript.onload = () => {
						console.info("[MCP Client] html2canvas loaded from unpkg CDN");
						resolve(true);
					};
					unpkgScript.onerror = (err) => {
						console.error("[MCP Client] Failed to load html2canvas:", err);
						reject(
							new Error(
								"Unable to load html2canvas library, please ensure your network connection is working",
							),
						);
					};
					document.head.appendChild(unpkgScript);
				};
				document.head.appendChild(localScript);
			};
			document.head.appendChild(script);
		});
	}

	/**
	 * Handle messages from server
	 */
	private handleServerMessage(message: MCPMessage): void {
		// Handle special request types
		if (message.type === "get_page_html") {
			// Handle request to get page HTML
			const requestId = message.requestId as string;
			try {
				const html = document.documentElement.outerHTML;
				this.sendResponse(requestId, { html });
			} catch (error) {
				this.sendError(
					requestId,
					`Error getting HTML: ${(error as Error).message}`,
				);
			}
			return;
		}

		if (message.type === "execute_js") {
			// Handle request to execute JavaScript
			const requestId = message.requestId as string;
			const code = message.code as string;
			try {
				// Use Function constructor to create function, then execute
				const result = new Function(code)();
				// Ensure result can be JSON serialized
				let serializedResult: string;
				try {
					serializedResult = JSON.stringify(result);
				} catch (err) {
					// If result cannot be serialized, return string representation
					serializedResult = String(result);
				}

				// Send response
				const response = {
					requestId,
					result: serializedResult,
				};

				this.ws?.send(JSON.stringify(response));
			} catch (error) {
				console.error("[MCP Client] Error executing JavaScript:", error);
				this.sendError(
					requestId,
					`Error executing JavaScript: ${(error as Error).message}`,
				);
			}
			return;
		}

		if (message.type === "get_page_title") {
			// Handle request to get page title
			const requestId = message.requestId as string;
			try {
				const title = document.title;
				this.sendResponse(requestId, { title });
			} catch (error) {
				this.sendError(
					requestId,
					`Error getting title: ${(error as Error).message}`,
				);
			}
			return;
		}

		if (message.type === "get_elements") {
			// Handle request to get elements
			const requestId = message.requestId as string;
			const selector = message.selector as string;
			try {
				const elements = [...document.querySelectorAll(selector)];
				const result = elements.map((el) => ({
					tagName: el.tagName,
					id: el.id,
					className: el.className,
					textContent: el.textContent?.trim().substring(0, 500) || "",
					attributes: [...el.attributes].reduce(
						(attrs: Record<string, string>, attr) => {
							attrs[attr.name] = attr.value;
							return attrs;
						},
						{},
					),
				}));
				this.sendResponse(requestId, { elements: result });
			} catch (error) {
				this.sendError(
					requestId,
					`Error getting elements: ${(error as Error).message}`,
				);
			}
			return;
		}

		if (message.type === "capture_screenshot") {
			// Handle screenshot request
			const requestId = message.requestId as string;
			const selector = (message.selector as string) || "body";

			// Process screenshot asynchronously
			(async () => {
				try {
					// Ensure html2canvas is loaded
					await this.loadHtml2Canvas();

					const element = document.querySelector(selector);
					if (!element) {
						this.sendError(requestId, `Element not found: ${selector}`);
						return;
					}

					// Use html2canvas for screenshot, add config for better compatibility
					const html2canvasOptions: Html2CanvasOptions = {
						allowTaint: true,
						useCORS: true,
						logging: false,
						scale: window.devicePixelRatio || 1,
						backgroundColor: null, // Transparent background
						removeContainer: true, // Remove temporary container
						// Calculate actual element size and position
						x: 0,
						y: 0,
						scrollX: 0,
						scrollY: 0,
						// Get actual element width and height
						width: (element as HTMLElement).offsetWidth,
						height: (element as HTMLElement).offsetHeight,
					};

					const html2canvas = (window as WindowWithHtml2Canvas).html2canvas;

					if (!html2canvas) {
						this.sendError(
							requestId,
							"html2canvas library not properly loaded",
						);
						return;
					}

					let canvas = await html2canvas(
						element as HTMLElement,
						html2canvasOptions,
					);

					if (!canvas) {
						this.sendError(
							requestId,
							"Screenshot failed: unable to create canvas",
						);
						return;
					}

					// Crop canvas, remove excess white space
					const context = canvas.getContext("2d");
					if (context) {
						// Try to detect content area, remove whitespace
						const imageData = context.getImageData(
							0,
							0,
							canvas.width,
							canvas.height,
						);
						const bounds = this.getContentBounds(imageData);

						if (bounds) {
							// If content boundaries found, create a new cropped canvas
							const croppedCanvas = document.createElement("canvas");
							croppedCanvas.width = bounds.width;
							croppedCanvas.height = bounds.height;

							const croppedContext = croppedCanvas.getContext("2d");
							if (croppedContext) {
								croppedContext.drawImage(
									canvas,
									bounds.left,
									bounds.top,
									bounds.width,
									bounds.height,
									0,
									0,
									bounds.width,
									bounds.height,
								);

								// Use cropped canvas
								canvas = croppedCanvas;
							}
						}
					}

					// Compress image quality to reduce data size, use PNG format to maintain transparency
					const dataUrl = canvas.toDataURL("image/png");
					this.sendResponse(requestId, { imageDataUrl: dataUrl });
				} catch (error) {
					console.error("[MCP Client] Screenshot error:", error);
					this.sendError(
						requestId,
						`Screenshot error: ${(error as Error).message}`,
					);
				}
			})();
			return;
		}

		if (message.type === "get_page_url") {
			// Handle request to get page URL
			const requestId = message.requestId as string;
			try {
				const url = window.location.href;
				this.sendResponse(requestId, { url });
			} catch (error) {
				this.sendError(
					requestId,
					`Error getting URL: ${(error as Error).message}`,
				);
			}
			return;
		}

		if (message.type === "click_element") {
			// Handle request to click element
			const requestId = message.requestId as string;
			const selector = message.selector as string;
			try {
				const element = document.querySelector(selector);
				if (!element) {
					this.sendError(requestId, `Element not found: ${selector}`);
					return;
				}

				(element as HTMLElement).click();
				this.sendResponse(requestId, {
					success: true,
					message: `Successfully clicked element: ${selector}`,
				});
			} catch (error) {
				this.sendError(
					requestId,
					`Error clicking element: ${(error as Error).message}`,
				);
			}
			return;
		}

		if (message.type === "input_text") {
			// Handle request to input text
			const requestId = message.requestId as string;
			const selector = message.selector as string;
			const text = message.text as string;

			try {
				const input = document.querySelector(selector);
				if (!input) {
					this.sendError(requestId, `Input field not found: ${selector}`);
					return;
				}

				if (input.tagName !== "INPUT" && input.tagName !== "TEXTAREA") {
					this.sendError(
						requestId,
						`Selected element is not an input field: ${input.tagName}`,
					);
					return;
				}

				(input as HTMLInputElement).value = text;
				input.dispatchEvent(new Event("input", { bubbles: true }));

				this.sendResponse(requestId, {
					success: true,
					message: `Successfully input text to: ${selector}`,
				});
			} catch (error) {
				this.sendError(
					requestId,
					`Error inputting text: ${(error as Error).message}`,
				);
			}
			return;
		}

		// Handle other message types
		switch (message.type) {
			case "command_result":
				console.info(
					`%c[MCP Server] ${message.payload?.result}`,
					"color: blue",
				);
				break;
			case "error":
				console.error(`[MCP Server] Error: ${message.payload?.error}`);
				break;
			case "connection_status":
				console.info(`%c[MCP Server] ${message.message}`, "color: green");
				break;
			default:
				// Only log message type, not full message content
				console.info(`[MCP Server] Received message type: ${message.type}`);
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
		this.commandHistory.push(command);
		this.historyIndex = this.commandHistory.length;
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
			help: () => {
				return `
MCP Client Commands:
  mcp.exec(command) - Execute a command
  mcp.disconnect() - Disconnect from server
  mcp.reconnect() - Reconnect to server
  mcp.help() - Show help information
        `;
			},
		};

		console.info(
			"%c[MCP Client] Console commands registered, use mcp.help() to see available commands",
			"color: green",
		);
	}

	/**
	 * Get image content boundaries, remove excess whitespace
	 */
	private getContentBounds(
		imageData: ImageData,
	): { left: number; top: number; width: number; height: number } | null {
		const { width, height, data } = imageData;
		let minX = width;
		let minY = height;
		let maxX = 0;
		let maxY = 0;
		let hasContent = false;

		// Iterate through pixel data, find boundaries of non-transparent pixels
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const alpha = data[(y * width + x) * 4 + 3]; // Alpha channel
				if (alpha > 10) {
					// Non-transparent pixel (allowing some slight transparency)
					hasContent = true;
					minX = Math.min(minX, x);
					minY = Math.min(minY, y);
					maxX = Math.max(maxX, x);
					maxY = Math.max(maxY, y);
				}
			}
		}

		if (!hasContent) {
			return null; // No content found
		}

		// Add some padding
		const padding = 10;
		minX = Math.max(0, minX - padding);
		minY = Math.max(0, minY - padding);
		maxX = Math.min(width - 1, maxX + padding);
		maxY = Math.min(height - 1, maxY + padding);

		return {
			left: minX,
			top: minY,
			width: maxX - minX + 1,
			height: maxY - minY + 1,
		};
	}
}

// Create and connect client instance
const client = new BrowserConsoleMCP();
client.connect();

// Export client instance
export default client;
