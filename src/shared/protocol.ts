export const PROTOCOL_VERSION = 1;

export type ConnectionMode = "console" | "plugin" | "extension";

export type SessionStatus = "connected" | "reconnecting" | "stale" | "closed";

export type BrowserCommandType =
	| "execute_js"
	| "get_page_html"
	| "get_page_title"
	| "get_elements"
	| "capture_screenshot"
	| "get_page_url"
	| "click_element"
	| "input_text"
	| "get_console_logs"
	| "get_network_requests"
	| "clear_browser_diagnostics";

export type ProtocolError = {
	code: string;
	message: string;
	retryable?: boolean;
};

export type ProtocolTarget = {
	tabId?: number;
	frameId?: number;
};

export type ProtocolMessage<T = Record<string, unknown>> = {
	version: number;
	id?: string;
	type: string;
	sessionId?: string;
	clientId?: string;
	target?: ProtocolTarget;
	payload?: T;
	error?: ProtocolError;
	timestamp: number;
};

export type BrowserHelloPayload = {
	mode: ConnectionMode;
	url: string;
	title: string;
	capabilities: string[];
	tabId?: number;
	frameId?: number;
};

export type BrowserSessionSnapshot = {
	sessionId: string;
	clientId: string;
	mode: ConnectionMode;
	tabId?: number;
	frameId?: number;
	url: string;
	title: string;
	status: SessionStatus;
	capabilities: string[];
	connectedAt: number;
	lastSeenAt: number;
	generation: number;
};

export type RpcRequest = {
	type: BrowserCommandType;
	payload?: Record<string, unknown>;
	sessionId?: string;
	timeoutMs?: number;
};

export type RpcResponse = {
	ok: boolean;
	session?: BrowserSessionSnapshot;
	result?: Record<string, unknown>;
	error?: ProtocolError;
};

export function createProtocolMessage<T = Record<string, unknown>>(
	type: string,
	fields: Omit<ProtocolMessage<T>, "version" | "type" | "timestamp"> = {},
): ProtocolMessage<T> {
	return {
		version: PROTOCOL_VERSION,
		type,
		timestamp: Date.now(),
		...fields,
	};
}

export function parseProtocolMessage(raw: string): ProtocolMessage | null {
	try {
		const message = JSON.parse(raw) as Partial<ProtocolMessage>;
		if (!message || typeof message.type !== "string") return null;
		return {
			version: message.version ?? PROTOCOL_VERSION,
			type: message.type,
			id: message.id,
			sessionId: message.sessionId,
			clientId: message.clientId,
			target: message.target,
			payload: message.payload,
			error: message.error,
			timestamp: message.timestamp ?? Date.now(),
		};
	} catch {
		return null;
	}
}
