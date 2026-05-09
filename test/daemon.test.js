import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import { startDaemon } from "../dist/browser/index.js";

function waitForOpen(ws) {
	return new Promise((resolve, reject) => {
		ws.on("open", resolve);
		ws.on("error", reject);
	});
}

async function waitForSession(daemon) {
	const deadline = Date.now() + 1000;
	while (Date.now() < deadline) {
		const response = await daemon
			.sendBrowserRequest({
				type: "get_page_url",
				timeoutMs: 50,
			})
			.catch(() => null);
		if (response?.ok) return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	throw new Error("Session did not become ready");
}

test("daemon routes browser requests through a fake browser", async () => {
	const daemon = await startDaemon({ port: 19198, writeRuntime: false });
	const ws = new WebSocket("ws://127.0.0.1:19198/browser");
	await waitForOpen(ws);

	ws.on("message", (raw) => {
		const message = JSON.parse(raw.toString());
		if (message.type === "get_page_url") {
			ws.send(JSON.stringify({ requestId: message.requestId, url: "https://example.test/" }));
		}
	});

	ws.send(JSON.stringify({
		version: 1,
		type: "hello",
		clientId: "test-client",
		sessionId: "test-session",
		timestamp: Date.now(),
		payload: {
			mode: "console",
			url: "https://example.test/",
			title: "Example",
			capabilities: ["get_page_url"],
		},
	}));

	await waitForSession(daemon);
	const response = await daemon.sendBrowserRequest({
		type: "get_page_url",
		timeoutMs: 500,
	});

	assert.equal(response.ok, true);
	assert.equal(response.result.url, "https://example.test/");
	assert.equal(response.session.sessionId, "test-session");

	ws.close();
	await daemon.stop();
});

test("daemon reports missing browser session as retryable error", async () => {
	const daemon = await startDaemon({ port: 19199, writeRuntime: false });
	const response = await daemon.sendBrowserRequest({
		type: "get_page_title",
		timeoutMs: 50,
	});

	assert.equal(response.ok, false);
	assert.equal(response.error.code, "NO_BROWSER_SESSION");
	assert.equal(response.error.retryable, true);

	await daemon.stop();
});
