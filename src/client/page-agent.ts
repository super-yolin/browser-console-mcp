import type { BrowserCommandType } from "../shared/protocol";

type MCPMessage = {
	type: BrowserCommandType;
	requestId?: string;
	code?: string;
	selector?: string;
	text?: string;
	payload?: Record<string, unknown>;
};

type Html2CanvasOptions = {
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
};

type WindowWithHtml2Canvas = Window & {
	html2canvas?: (
		element: HTMLElement,
		options?: Html2CanvasOptions,
	) => Promise<HTMLCanvasElement>;
	__BCM_DIAGNOSTICS__?: DiagnosticsState;
	__BCM_DIAGNOSTICS_INSTALLED__?: boolean;
};

type ConsoleEntry = {
	ts: string;
	level: "log" | "info" | "warn" | "error" | "debug";
	args: string[];
};

type NetworkEntry = {
	ts: string;
	kind: "fetch" | "xhr" | "resource";
	url: string;
	method?: string;
	status?: number;
	ok?: boolean;
	duration?: number;
	transferSize?: number;
	error?: string;
};

type DiagnosticsState = {
	console: ConsoleEntry[];
	network: NetworkEntry[];
};

export class PageAgent {
	readonly capabilities = [
		"execute_js",
		"get_page_html",
		"get_page_title",
		"get_elements",
		"capture_screenshot",
		"get_page_url",
		"click_element",
		"input_text",
		"get_console_logs",
		"get_network_requests",
		"clear_browser_diagnostics",
	];

	constructor() {
		this.installDiagnostics();
	}

	async handleCommand(message: MCPMessage): Promise<Record<string, unknown>> {
		if (message.type === "get_page_html") {
			return { html: document.documentElement.outerHTML };
		}

		if (message.type === "execute_js") {
			const result = new Function(message.code ?? "return null;")();
			return { result: this.serializeResult(result) };
		}

		if (message.type === "get_page_title") {
			return { title: document.title };
		}

		if (message.type === "get_elements") {
			const selector = this.requireString(message.selector, "selector");
			const elements = Array.from(document.querySelectorAll(selector));
			return {
				elements: elements.map((el) => {
					const attributes: Record<string, string> = {};
					for (const attr of Array.from(el.attributes)) {
						attributes[attr.name] = attr.value;
					}
					return {
						tagName: el.tagName,
						id: el.id,
						className: el.className,
						textContent: el.textContent?.trim().substring(0, 500) || "",
						attributes,
					};
				}),
			};
		}

		if (message.type === "capture_screenshot") {
			await this.loadHtml2Canvas();
			const selector = message.selector || "body";
			const element = document.querySelector(selector);
			if (!element) throw new Error(`Element not found: ${selector}`);
			const html2canvas = (window as WindowWithHtml2Canvas).html2canvas;
			if (!html2canvas) throw new Error("html2canvas library not properly loaded");

			let canvas = await html2canvas(element as HTMLElement, {
				allowTaint: true,
				useCORS: true,
				logging: false,
				scale: window.devicePixelRatio || 1,
				backgroundColor: null,
				removeContainer: true,
				x: 0,
				y: 0,
				scrollX: 0,
				scrollY: 0,
				width: (element as HTMLElement).offsetWidth,
				height: (element as HTMLElement).offsetHeight,
			});

			const context = canvas.getContext("2d");
			if (context) {
				const bounds = this.getContentBounds(
					context.getImageData(0, 0, canvas.width, canvas.height),
				);
				if (bounds) {
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
						canvas = croppedCanvas;
					}
				}
			}

			return { imageDataUrl: canvas.toDataURL("image/png") };
		}

		if (message.type === "get_page_url") {
			return { url: window.location.href };
		}

		if (message.type === "click_element") {
			const selector = this.requireString(message.selector, "selector");
			const element = document.querySelector(selector);
			if (!element) throw new Error(`Element not found: ${selector}`);
			(element as HTMLElement).click();
			return { success: true, message: `Successfully clicked element: ${selector}` };
		}

		if (message.type === "input_text") {
			const selector = this.requireString(message.selector, "selector");
			const text = this.requireString(message.text, "text");
			const input = document.querySelector(selector);
			if (!input) throw new Error(`Input field not found: ${selector}`);
			if (input.tagName !== "INPUT" && input.tagName !== "TEXTAREA") {
				throw new Error(`Selected element is not an input field: ${input.tagName}`);
			}
			(input as HTMLInputElement | HTMLTextAreaElement).value = text;
			input.dispatchEvent(new Event("input", { bubbles: true }));
			return { success: true, message: `Successfully input text to: ${selector}` };
		}

		if (message.type === "get_console_logs") {
			const level = typeof message.payload?.level === "string" ? message.payload.level : undefined;
			const limit = this.getLimit(message.payload?.limit);
			const logs = this.getDiagnostics().console
				.filter((entry) => !level || entry.level === level)
				.slice(-limit);
			return { logs, count: logs.length };
		}

		if (message.type === "get_network_requests") {
			const limit = this.getLimit(message.payload?.limit);
			const includeResources = message.payload?.includeResources === true;
			const diagnostics = this.getDiagnostics();
			const resourceEntries: NetworkEntry[] = includeResources
				? performance.getEntriesByType("resource").map((entry) => {
						const resource = entry as PerformanceResourceTiming;
						return {
							ts: new Date(performance.timeOrigin + resource.startTime).toISOString(),
							kind: "resource",
							url: resource.name,
							duration: Math.round(resource.duration),
							transferSize: resource.transferSize || 0,
						};
					})
				: [];
			const network = [...resourceEntries, ...diagnostics.network].slice(-limit);
			return { requests: network, count: network.length };
		}

		if (message.type === "clear_browser_diagnostics") {
			const diagnostics = this.getDiagnostics();
			const cleared = {
				console: diagnostics.console.length,
				network: diagnostics.network.length,
			};
			diagnostics.console.length = 0;
			diagnostics.network.length = 0;
			return { cleared };
		}

		throw new Error(`Unsupported command type: ${message.type}`);
	}

	private serializeResult(result: unknown): string {
		try {
			return JSON.stringify(result);
		} catch {
			return String(result);
		}
	}

	private requireString(value: unknown, name: string): string {
		if (typeof value !== "string" || value.length === 0) {
			throw new Error(`Missing required ${name}`);
		}
		return value;
	}

	private getLimit(value: unknown): number {
		if (typeof value !== "number" || !Number.isFinite(value)) return 50;
		return Math.max(1, Math.min(500, Math.floor(value)));
	}

	private installDiagnostics(): void {
		const target = window as WindowWithHtml2Canvas;
		if (target.__BCM_DIAGNOSTICS_INSTALLED__) return;
		target.__BCM_DIAGNOSTICS_INSTALLED__ = true;
		const diagnostics = this.getDiagnostics();
		const push = <T>(items: T[], item: T) => {
			items.push(item);
			if (items.length > 500) items.shift();
		};

		for (const level of ["log", "info", "warn", "error", "debug"] as const) {
			const original = console[level].bind(console);
			console[level] = (...args: unknown[]) => {
				push(diagnostics.console, {
					ts: new Date().toISOString(),
					level,
					args: args.map((arg) => this.stringifyDiagnosticValue(arg)),
				});
				original(...args);
			};
		}

		const originalFetch = window.fetch.bind(window);
		window.fetch = async (...args: Parameters<typeof fetch>) => {
			const started = performance.now();
			const url = this.getFetchUrl(args[0]);
			try {
				const response = await originalFetch(...args);
				push(diagnostics.network, {
					ts: new Date().toISOString(),
					kind: "fetch",
					url,
					status: response.status,
					ok: response.ok,
					duration: Math.round(performance.now() - started),
				});
				return response;
			} catch (error) {
				push(diagnostics.network, {
					ts: new Date().toISOString(),
					kind: "fetch",
					url,
					error: String(error),
					duration: Math.round(performance.now() - started),
				});
				throw error;
			}
		};

		const OriginalXHR = window.XMLHttpRequest;
		window.XMLHttpRequest = function BCMXMLHttpRequest() {
			const xhr = new OriginalXHR();
			let method = "GET";
			let url = "";
			let started = 0;
			const originalOpen = xhr.open;
			xhr.open = function open(
				nextMethod: string,
				nextUrl: string | URL,
				async?: boolean,
				username?: string | null,
				password?: string | null,
			) {
				method = nextMethod;
				url = String(nextUrl);
				return originalOpen.call(
					xhr,
					nextMethod,
					nextUrl,
					async ?? true,
					username ?? null,
					password ?? null,
				);
			};
			const originalSend = xhr.send;
			xhr.send = function send(...args: Parameters<XMLHttpRequest["send"]>) {
				started = performance.now();
				return originalSend.apply(xhr, args);
			};
			xhr.addEventListener("loadend", () => {
				push(diagnostics.network, {
					ts: new Date().toISOString(),
					kind: "xhr",
					method,
					url,
					status: xhr.status,
					duration: Math.round(performance.now() - started),
				});
			});
			return xhr;
		} as unknown as typeof XMLHttpRequest;
	}

	private getDiagnostics(): DiagnosticsState {
		const target = window as WindowWithHtml2Canvas;
		if (!target.__BCM_DIAGNOSTICS__) {
			target.__BCM_DIAGNOSTICS__ = { console: [], network: [] };
		}
		return target.__BCM_DIAGNOSTICS__;
	}

	private stringifyDiagnosticValue(value: unknown): string {
		if (typeof value === "string") return value;
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}

	private getFetchUrl(input: RequestInfo | URL): string {
		if (typeof input === "string") return input;
		if (input instanceof URL) return input.toString();
		return input.url;
	}

	async loadHtml2Canvas(): Promise<void> {
		if (typeof (window as WindowWithHtml2Canvas).html2canvas !== "undefined") {
			return;
		}

		await this.loadScript("https://html2canvas.hertzen.com/dist/html2canvas.min.js")
			.catch(() => this.loadScript("/html2canvas.min.js"))
			.catch(() => this.loadScript("https://unpkg.com/html2canvas/dist/html2canvas.min.js"));
	}

	private loadScript(src: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = src;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
			document.head.appendChild(script);
		});
	}

	private getContentBounds(
		imageData: ImageData,
	): { left: number; top: number; width: number; height: number } | null {
		const { width, height, data } = imageData;
		let minX = width;
		let minY = height;
		let maxX = 0;
		let maxY = 0;
		let hasContent = false;

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const alpha = data[(y * width + x) * 4 + 3];
				if (alpha > 10) {
					hasContent = true;
					minX = Math.min(minX, x);
					minY = Math.min(minY, y);
					maxX = Math.max(maxX, x);
					maxY = Math.max(maxY, y);
				}
			}
		}

		if (!hasContent) return null;

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
