/**
 * Browser MCP Injection Script
 *
 * This script is used to inject the MCP client in the browser
 */

(() => {
	// Check if MCP client is already loaded
	if (window.mcp) {
		console.info("[Browser MCP] MCP client already loaded");
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
		console.info("[Browser MCP] MCP client loaded successfully");
	};
	script.onerror = (error) => {
		console.error("[Browser MCP] Failed to load MCP client:", error);
	};

	document.head.appendChild(script);

	console.info("[Browser MCP] Loading MCP client...");
})();
