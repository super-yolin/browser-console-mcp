import assert from "node:assert/strict";
import test from "node:test";
import { browserConsoleMCP } from "../dist/vite/index.js";

test("Vite plugin injects Browser Console MCP only during serve", () => {
	const plugin = browserConsoleMCP({
		daemonUrl: "http://localhost:19197",
	});

	assert.equal(plugin.name, "browser-console-mcp");
	assert.equal(plugin.apply, "serve");

	const tags = plugin.transformIndexHtml();
	assert.equal(tags.length, 2);
	assert.match(tags[0].children, /mode: "plugin"/);
	assert.match(tags[0].children, /ws:\/\/localhost:19197\/browser/);
	assert.equal(tags[1].attrs.src, "http://localhost:19197/browser-console-mcp.js");
});

test("Vite plugin can be disabled with autoConnect false", () => {
	const plugin = browserConsoleMCP({ autoConnect: false });
	assert.deepEqual(plugin.transformIndexHtml(), []);
});
