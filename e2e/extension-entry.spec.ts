import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import { startDaemon, type BrowserConsoleDaemon } from "../dist/browser/index.js";

test.describe("Chrome extension entry", () => {
	let daemon: BrowserConsoleDaemon;
	let context: BrowserContext;
	let userDataDir: string;
	const port = 19202;

	test.beforeEach(async () => {
		daemon = await startDaemon({ port, writeRuntime: false });
		userDataDir = await mkdtemp(join(tmpdir(), "bcm-extension-"));
		const extensionPath = resolve("extension");
		context = await chromium.launchPersistentContext(userDataDir, {
			channel: "chromium",
			headless: false,
			args: [
				`--disable-extensions-except=${extensionPath}`,
				`--load-extension=${extensionPath}`,
			],
		});
	});

	test.afterEach(async () => {
		await context.close();
		await daemon.stop();
		await rm(userDataDir, { recursive: true, force: true });
	});

	test("auto-injects into an HTTP page and registers an extension session", async () => {
		const page = context.pages()[0] ?? (await context.newPage());
		await page.goto(`http://127.0.0.1:${port}/__extension_e2e`);

		await expect
			.poll(async () => {
				const response = await fetch(`http://127.0.0.1:${port}/sessions`);
				const status = await response.json();
				const extensionSession = status.sessions.find(
					(session: { mode: string }) => session.mode === "extension",
				);
				return extensionSession?.sessionId ?? null;
			}, { timeout: 10000 })
			.not.toBeNull();

		const sessionsResponse = await fetch(`http://127.0.0.1:${port}/sessions`);
		const status = await sessionsResponse.json();
		const extensionSession = status.sessions.find(
			(session: { mode: string }) => session.mode === "extension",
		);

		const title = await daemon.sendBrowserRequest({
			type: "get_page_title",
			sessionId: extensionSession.sessionId,
			timeoutMs: 1000,
		});

		expect(title.ok).toBe(true);
		expect(title.session?.mode).toBe("extension");
		expect(title.result?.title).toBe("Browser Console MCP");
	});
});
