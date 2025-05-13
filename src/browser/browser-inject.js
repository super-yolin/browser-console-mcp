/**
 * Browser MCP Injection Script
 *
 * This script is used to inject the MCP client in the browser
 */

(() => {
	// Check if MCP client is already loaded
	if (window.mcp) {
		console.log("[BCM] MCP client already loaded");
		return;
	}

	// Get current script URL to determine server address
	const currentScript = document.currentScript;
	const scriptUrl = currentScript ? currentScript.src : "";
	const serverUrl = scriptUrl
		? new URL(scriptUrl).origin
		: "http://localhost:7898";

	// Load MCP client script
	const script = document.createElement("script");
	script.src = `${serverUrl}/browser-console-mcp.js`;
	script.onload = () => {
		console.log("[BCM] MCP client loaded successfully");
	};
	script.onerror = (error) => {
		console.error("[BCM] Failed to load MCP client:", error);
	};

	document.head.appendChild(script);

	console.log("[BCM] Loading MCP client...");
})();
