/**
 * Browser MCP Server
 *
 * MCP server running in the browser, providing page content access and JavaScript execution capabilities to Cursor
 */

(() => {
	// MCP server version
	const VERSION = "1.0.0";

	// MCP protocol constants
	const MCP_VERSION = "2025-03-26";
	const RPC_VERSION = "2.0";

	// Load html2canvas
	async function loadHtml2Canvas() {
		return new Promise((resolve, reject) => {
			if (typeof html2canvas !== "undefined") {
				console.log("[BCM] html2canvas already loaded");
				resolve();
				return;
			}

			console.log("[BCM] Loading html2canvas...");
			const script = document.createElement("script");
			// Try local path
			script.src = "/html2canvas.min.js";
			script.onload = () => {
				console.log("[BCM] html2canvas loaded successfully");
				resolve();
			};
			script.onerror = () => {
				// If local path fails, try alternative path
				console.log("[BCM] Trying alternative path for html2canvas...");
				const altScript = document.createElement("script");
				altScript.src =
					"https://html2canvas.hertzen.com/dist/html2canvas.min.js";
				altScript.onload = () => {
					console.log("[BCM] html2canvas loaded from CDN successfully");
					resolve();
				};
				altScript.onerror = (error) => {
					console.error("[BCM] Failed to load html2canvas:", error);
					reject(new Error("Unable to load html2canvas"));
				};
				document.head.appendChild(altScript);
			};
			document.head.appendChild(script);
		});
	}

	// Tool definitions
	const TOOLS = {
		// Execute JavaScript code
		executeJS: {
			name: "executeJS",
			description: "Execute JavaScript code in the current page context",
			inputSchema: {
				type: "object",
				properties: {
					code: {
						type: "string",
						description: "JavaScript code to execute",
					},
				},
				required: ["code"],
			},
			annotations: {
				title: "Execute JavaScript",
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: true,
			},
			handler: async (params) => {
				try {
					// Use Function constructor to create function, then execute
					// This allows code to access window object and DOM
					const result = new Function(params.code || "return null;")();
					return {
						content: [
							{
								type: "text",
								text: `Operation successful: ${JSON.stringify(result)}`,
							},
						],
					};
				} catch (error) {
					return {
						isError: true,
						content: [
							{
								type: "text",
								text: `Error: ${error.message}`,
							},
						],
					};
				}
			},
		},

		// Get page HTML
		getPageHTML: {
			name: "getPageHTML",
			description: "Get HTML content of the current page",
			inputSchema: {
				type: "object",
				properties: {},
				required: [],
			},
			annotations: {
				title: "Get Page HTML",
				readOnlyHint: true,
				openWorldHint: false,
			},
			handler: async (params) => {
				try {
					return {
						html: document.documentElement.outerHTML,
					};
				} catch (error) {
					throw new Error(`Error getting HTML: ${error.message}`);
				}
			},
		},

		// Get page title
		getPageTitle: {
			name: "getPageTitle",
			description: "Get title of the current page",
			inputSchema: {
				type: "object",
				properties: {},
				required: [],
			},
			annotations: {
				title: "Get Page Title",
				readOnlyHint: true,
				openWorldHint: false,
			},
			handler: async () => {
				try {
					return {
						title: document.title,
					};
				} catch (error) {
					throw new Error(`Error getting title: ${error.message}`);
				}
			},
		},

		// Get elements
		getElements: {
			name: "getElements",
			description: "Use CSS selector to get elements on the page",
			inputSchema: {
				type: "object",
				properties: {
					selector: {
						type: "string",
						description: "CSS selector",
					},
				},
				required: ["selector"],
			},
			annotations: {
				title: "Get Elements",
				readOnlyHint: true,
				openWorldHint: false,
			},
			handler: async (params) => {
				try {
					const elements = [...document.querySelectorAll(params.selector)];
					return {
						elements: elements.map((el) => ({
							tagName: el.tagName,
							id: el.id,
							className: el.className,
							textContent: el.textContent.trim().substring(0, 500),
							attributes: [...el.attributes].reduce((attrs, attr) => {
								attrs[attr.name] = attr.value;
								return attrs;
							}, {}),
						})),
					};
				} catch (error) {
					throw new Error(`Error getting elements: ${error.message}`);
				}
			},
		},

		// Capture page screenshot
		captureScreenshot: {
			name: "captureScreenshot",
			description: "Capture screenshot of the current page (using html2canvas)",
			inputSchema: {
				type: "object",
				properties: {
					selector: {
						type: "string",
						description:
							"Optional CSS selector, used to capture specific elements",
						default: "body",
					},
				},
				required: [],
			},
			annotations: {
				title: "Capture Page Screenshot",
				readOnlyHint: true,
				openWorldHint: false,
			},
			handler: async (params) => {
				try {
					// Check if html2canvas is available
					if (typeof html2canvas === "undefined") {
						throw new Error("html2canvas not loaded, cannot take screenshot");
					}

					const selector = params.selector || "body";
					const element = document.querySelector(selector);

					if (!element) {
						throw new Error(`Element not found: ${selector}`);
					}

					const canvas = await html2canvas(element);
					const dataUrl = canvas.toDataURL("image/png");

					return {
						imageDataUrl: dataUrl,
					};
				} catch (error) {
					throw new Error(`Error capturing screenshot: ${error.message}`);
				}
			},
		},

		// Get page URL
		getPageURL: {
			name: "getPageURL",
			description: "Get URL of the current page",
			inputSchema: {
				type: "object",
				properties: {},
				required: [],
			},
			annotations: {
				title: "Get Page URL",
				readOnlyHint: true,
				openWorldHint: false,
			},
			handler: async () => {
				try {
					return {
						url: window.location.href,
					};
				} catch (error) {
					throw new Error(`Error getting URL: ${error.message}`);
				}
			},
		},

		// Click element
		clickElement: {
			name: "clickElement",
			description: "Click element on the page",
			inputSchema: {
				type: "object",
				properties: {
					selector: {
						type: "string",
						description: "CSS selector of the element to click",
					},
				},
				required: ["selector"],
			},
			annotations: {
				title: "Click Element",
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: false,
			},
			handler: async (params) => {
				try {
					const element = document.querySelector(params.selector);

					if (!element) {
						throw new Error(`Element not found: ${params.selector}`);
					}

					element.click();

					return {
						success: true,
						message: `Element clicked successfully: ${params.selector}`,
					};
				} catch (error) {
					throw new Error(`Error clicking element: ${error.message}`);
				}
			},
		},

		// Input text
		inputText: {
			name: "inputText",
			description: "Enter text into input field",
			inputSchema: {
				type: "object",
				properties: {
					selector: {
						type: "string",
						description: "CSS selector of the input field",
					},
					text: {
						type: "string",
						description: "Text to enter",
					},
				},
				required: ["selector", "text"],
			},
			annotations: {
				title: "Input Text",
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: false,
				openWorldHint: false,
			},
			handler: async (params) => {
				try {
					const input = document.querySelector(params.selector);

					if (!input) {
						throw new Error(`Input field not found: ${params.selector}`);
					}

					if (input.tagName !== "INPUT" && input.tagName !== "TEXTAREA") {
						throw new Error(
							`Selected element is not an input field: ${input.tagName}`,
						);
					}

					input.value = params.text;

					// Trigger input event to notify form change
					input.dispatchEvent(new Event("input", { bubbles: true }));

					return {
						success: true,
						message: `Text entered successfully to: ${params.selector}`,
					};
				} catch (error) {
					throw new Error(`Error entering text: ${error.message}`);
				}
			},
		},
	};

	// MCP server class
	class BrowserMCPServer {
		constructor() {
			this.socket = null;
			this.connected = false;
			this.nextId = 1;
			this.pendingRequests = new Map();

			// Initialize and bind methods
			this.initSocket = this.initSocket.bind(this);
			this.handleMessage = this.handleMessage.bind(this);
			this.sendResponse = this.sendResponse.bind(this);
			this.handleRequest = this.handleRequest.bind(this);
		}

		/**
		 * Initialize WebSocket connection
		 * @param {string} url WebSocket server URL
		 */
		async initSocket(url) {
			try {
				// Close existing connection
				if (this.socket) {
					this.socket.close();
				}

				// Load html2canvas
				await loadHtml2Canvas();

				this.socket = new WebSocket(url);

				this.socket.onopen = () => {
					console.log("[BCM] Connected to Cursor");
					this.connected = true;

					// Send initialization and capability negotiation message
					this.sendInitialization();
				};

				this.socket.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (error) {
						console.error("[BCM] Message parsing error:", error);
					}
				};

				this.socket.onclose = () => {
					console.log("[BCM] Connection closed");
					this.connected = false;
				};

				this.socket.onerror = (error) => {
					console.error("[BCM] WebSocket error:", error);
				};

				return true;
			} catch (error) {
				console.error("[BCM] Error initializing WebSocket:", error);
				return false;
			}
		}

		/**
		 * Send MCP initialization and capability negotiation message
		 */
		sendInitialization() {
			// Send initialization message
			const message = {
				jsonrpc: RPC_VERSION,
				method: "initialize",
				id: this.nextId++,
				params: {
					protocol_version: MCP_VERSION,
					name: "Browser MCP Server",
					version: VERSION,
					vendor: "Browser Console MCP",
					offerings: {
						tools: Object.keys(TOOLS).map((key) => {
							const tool = TOOLS[key];
							return {
								name: tool.name,
								description: tool.description,
								inputSchema: tool.inputSchema,
								annotations: tool.annotations,
							};
						}),
					},
				},
			};

			// Send message
			this.socket.send(JSON.stringify(message));

			// Log
			console.log("[BCM] Initialization message sent");
		}

		/**
		 * Handle received message
		 * @param {Object} message Message object
		 */
		async handleMessage(message) {
			try {
				// Parse message
				const jsonMessage =
					typeof message === "string" ? JSON.parse(message) : message;

				// Handle specific type requests
				if (jsonMessage.type === "execute_js" && jsonMessage.code) {
					// Execute JavaScript code
					try {
						const result = new Function(jsonMessage.code || "return null;")();
						this.sendResponse(jsonMessage.requestId, { result });
					} catch (error) {
						this.sendResponse(jsonMessage.requestId, { error: error.message });
					}
					return;
				}

				if (jsonMessage.type === "get_page_html") {
					// Get page HTML
					try {
						const html = document.documentElement.outerHTML;
						this.sendResponse(jsonMessage.requestId, { html });
					} catch (error) {
						this.sendResponse(jsonMessage.requestId, { error: error.message });
					}
					return;
				}

				if (jsonMessage.type === "get_page_title") {
					// Get page title
					try {
						const title = document.title;
						this.sendResponse(jsonMessage.requestId, { title });
					} catch (error) {
						this.sendResponse(jsonMessage.requestId, { error: error.message });
					}
					return;
				}

				if (jsonMessage.type === "get_elements" && jsonMessage.selector) {
					// Get elements
					try {
						const elements = [
							...document.querySelectorAll(jsonMessage.selector),
						];
						const result = elements.map((el) => ({
							tagName: el.tagName,
							id: el.id,
							className: el.className,
							textContent: el.textContent.trim().substring(0, 500),
							attributes: [...el.attributes].reduce((attrs, attr) => {
								attrs[attr.name] = attr.value;
								return attrs;
							}, {}),
						}));
						this.sendResponse(jsonMessage.requestId, { elements: result });
					} catch (error) {
						this.sendResponse(jsonMessage.requestId, { error: error.message });
					}
					return;
				}

				if (jsonMessage.type === "capture_screenshot") {
					// Capture page screenshot
					try {
						// Ensure html2canvas is loaded
						if (typeof html2canvas === "undefined") {
							// Try reloading
							await loadHtml2Canvas();

							// Check again
							if (typeof html2canvas === "undefined") {
								throw new Error(
									"html2canvas not loaded, cannot take screenshot",
								);
							}
						}

						const selector = jsonMessage.selector || "body";
						const element = document.querySelector(selector);

						if (!element) {
							throw new Error(`Element not found: ${selector}`);
						}

						html2canvas(element)
							.then((canvas) => {
								const dataUrl = canvas.toDataURL("image/png");
								this.sendResponse(jsonMessage.requestId, {
									imageDataUrl: dataUrl,
								});
							})
							.catch((error) => {
								this.sendResponse(jsonMessage.requestId, {
									error: error.message,
								});
							});
					} catch (error) {
						this.sendResponse(jsonMessage.requestId, { error: error.message });
					}
					return;
				}

				if (jsonMessage.type === "get_page_url") {
					// Get page URL
					try {
						const url = window.location.href;
						this.sendResponse(jsonMessage.requestId, { url });
					} catch (error) {
						this.sendResponse(jsonMessage.requestId, { error: error.message });
					}
					return;
				}

				if (jsonMessage.type === "click_element" && jsonMessage.selector) {
					// Click element
					try {
						const element = document.querySelector(jsonMessage.selector);

						if (!element) {
							throw new Error(`Element not found: ${jsonMessage.selector}`);
						}

						element.click();
						this.sendResponse(jsonMessage.requestId, {
							success: true,
							message: `Element clicked successfully: ${jsonMessage.selector}`,
						});
					} catch (error) {
						this.sendResponse(jsonMessage.requestId, { error: error.message });
					}
					return;
				}

				if (
					jsonMessage.type === "input_text" &&
					jsonMessage.selector &&
					jsonMessage.text !== undefined
				) {
					// Input text
					try {
						const input = document.querySelector(jsonMessage.selector);

						if (!input) {
							throw new Error(`Input field not found: ${jsonMessage.selector}`);
						}

						if (input.tagName !== "INPUT" && input.tagName !== "TEXTAREA") {
							throw new Error(
								`Selected element is not an input field: ${input.tagName}`,
							);
						}

						input.value = jsonMessage.text;
						input.dispatchEvent(new Event("input", { bubbles: true }));
						this.sendResponse(jsonMessage.requestId, {
							success: true,
							message: `Text entered successfully to: ${jsonMessage.selector}`,
						});
					} catch (error) {
						this.sendResponse(jsonMessage.requestId, { error: error.message });
					}
					return;
				}

				// Handle RPC requests
				if (jsonMessage.jsonrpc === RPC_VERSION) {
					if (jsonMessage.method) {
						// This is a request
						this.handleRequest(jsonMessage);
					}
				}
			} catch (error) {
				console.error("[BCM] Message parsing error:", error.message);
			}
		}

		/**
		 * Handle RPC request
		 * @param {Object} request Request object
		 */
		async handleRequest(request) {
			const { id, method, params } = request;

			// Handle initialization response
			if (method === "initialize/result") {
				console.log("[BCM] Initialization successful");
				this.sendResponse(id, { success: true });
				return;
			}

			// Handle tool call
			if (method === "executeToolCall") {
				const { toolCall } = params;

				if (!toolCall || !toolCall.name) {
					this.sendErrorResponse(id, -32602, "Invalid tool call parameters");
					return;
				}

				const tool = Object.values(TOOLS).find((t) => t.name === toolCall.name);

				if (!tool) {
					this.sendErrorResponse(
						id,
						-32601,
						`Tool not found: ${toolCall.name}`,
					);
					return;
				}

				try {
					const result = await tool.handler(toolCall.parameters || {});
					this.sendResponse(id, { result });
				} catch (error) {
					this.sendErrorResponse(id, -32603, error.message);
				}

				return;
			}

			// Handle unknown method
			this.sendErrorResponse(id, -32601, `Method not found: ${method}`);
		}

		/**
		 * Send response
		 * @param {number} id Request ID
		 * @param {Object} result Response result
		 */
		sendResponse(id, result) {
			if (!this.connected || !this.socket) {
				console.error("[BCM] Not connected, cannot send response");
				return;
			}

			const response = {
				jsonrpc: RPC_VERSION,
				id,
				result,
			};

			this.socket.send(JSON.stringify(response));
		}

		/**
		 * Send error response
		 * @param {number} id Request ID
		 * @param {number} code Error code
		 * @param {string} message Error message
		 */
		sendErrorResponse(id, code, message) {
			if (!this.connected || !this.socket) {
				console.error("[BCM] Not connected, cannot send error response");
				return;
			}

			const response = {
				jsonrpc: RPC_VERSION,
				id,
				error: {
					code,
					message,
				},
			};

			this.socket.send(JSON.stringify(response));
		}
	}

	// Create global instance
	window.browserMCP = new BrowserMCPServer();

	// Expose global helper function, used for connecting from console
	window.connectMCP = (url = "ws://localhost:9000") => {
		return window.browserMCP.initSocket(url);
	};

	console.log(
		"[BCM] MCP server initialized, use window.connectMCP(url) to connect to Cursor",
	);
})();
