type HtmlTagDescriptor = {
	tag: string;
	attrs?: Record<string, string>;
	children?: string;
	injectTo?: "head" | "body" | "head-prepend" | "body-prepend";
};

type VitePlugin = {
	name: string;
	apply: "serve";
	transformIndexHtml: () => HtmlTagDescriptor[];
};

export type BrowserConsoleMCPViteOptions = {
	daemonUrl?: string;
	autoConnect?: boolean;
};

export function browserConsoleMCP(
	options: BrowserConsoleMCPViteOptions = {},
): VitePlugin {
	const daemonUrl = options.daemonUrl ?? "http://localhost:7898";
	const wsUrl = daemonUrl.replace(/^http/, "ws");
	const autoConnect = options.autoConnect ?? true;

	return {
		name: "browser-console-mcp",
		apply: "serve",
		transformIndexHtml() {
			if (!autoConnect) return [];
			return [
				{
					tag: "script",
					children: `window.__BCM_CONFIG__ = { serverUrl: ${JSON.stringify(`${wsUrl}/browser`)}, mode: "plugin" };`,
					injectTo: "head",
				},
				{
					tag: "script",
					attrs: {
						src: `${daemonUrl}/browser-console-mcp.js`,
					},
					injectTo: "body",
				},
			];
		},
	};
}
