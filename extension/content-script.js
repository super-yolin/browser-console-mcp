const DEFAULT_DAEMON_URL = "http://localhost:7898";

function injectPageAgent() {
	if (window.__BCM_EXTENSION_INJECTED__) return;
	window.__BCM_EXTENSION_INJECTED__ = true;
	const daemonUrl =
		(location.hostname === "127.0.0.1" || location.hostname === "localhost") &&
		location.port
			? location.origin
			: DEFAULT_DAEMON_URL;

	const script = document.createElement("script");
	const serverUrl = `${daemonUrl.replace(/^http/, "ws")}/browser`;
	script.src = `${daemonUrl}/browser-console-mcp.js?mode=extension&serverUrl=${encodeURIComponent(serverUrl)}`;
	script.onload = () => script.remove();
	(document.head || document.documentElement).appendChild(script);
}

injectPageAgent();

let lastUrl = location.href;
setInterval(() => {
	if (lastUrl === location.href) return;
	lastUrl = location.href;
	chrome.runtime.sendMessage({
		type: "page:navigated",
		url: location.href,
		title: document.title,
	});
}, 1000);

window.addEventListener("pagehide", () => {
	chrome.runtime.sendMessage({
		type: "page:closing",
		url: location.href,
		title: document.title,
	});
});
