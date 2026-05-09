import { expect, test, type Page } from "@playwright/test";
import { startDaemon, type BrowserConsoleDaemon } from "../dist/browser/index.js";

async function preparePage(page: Page, port: number, title: string): Promise<void> {
	await page.goto(`http://127.0.0.1:${port}/__e2e_${encodeURIComponent(title)}`);
	await page.setContent(`<!doctype html><title>${title}</title><main>${title}</main>`);
	await page.evaluate(() => {
		Object.defineProperty(window, "html2canvas", {
			value: async () => {
				const canvas = document.createElement("canvas");
				canvas.width = 1;
				canvas.height = 1;
				return canvas;
			},
			configurable: true,
		});
	});
}

async function inject(page: Page, port: number): Promise<string> {
	await page.addScriptTag({ url: `http://127.0.0.1:${port}/browser-inject.js` });
	await expect
		.poll(() => page.evaluate(() => window.mcp?.status().connected))
		.toBe(true);
	return page.evaluate(() => window.mcp.status().sessionId as string);
}

test.describe("session routing", () => {
	let daemon: BrowserConsoleDaemon;
	const port = 19201;

	test.beforeEach(async () => {
		daemon = await startDaemon({ port, writeRuntime: false });
	});

	test.afterEach(async () => {
		await daemon.stop();
	});

	test("lists multiple sessions and routes by explicit sessionId", async ({ browser }) => {
		const pageA = await browser.newPage();
		const pageB = await browser.newPage();
		await preparePage(pageA, port, "Session A");
		await preparePage(pageB, port, "Session B");

		const sessionA = await inject(pageA, port);
		const sessionB = await inject(pageB, port);

		const sessionsResponse = await fetch(`http://127.0.0.1:${port}/sessions`);
		const sessions = await sessionsResponse.json();
		expect(sessions.sessions.map((session: { sessionId: string }) => session.sessionId))
			.toEqual(expect.arrayContaining([sessionA, sessionB]));

		const titleA = await daemon.sendBrowserRequest({
			type: "get_page_title",
			sessionId: sessionA,
			timeoutMs: 1000,
		});
		const titleB = await daemon.sendBrowserRequest({
			type: "get_page_title",
			sessionId: sessionB,
			timeoutMs: 1000,
		});

		expect(titleA.result?.title).toBe("Session A");
		expect(titleB.result?.title).toBe("Session B");

		const selectResponse = await fetch(`http://127.0.0.1:${port}/select-session`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ sessionId: sessionA }),
		});
		expect(selectResponse.ok).toBe(true);

		const activeTitle = await daemon.sendBrowserRequest({
			type: "get_page_title",
			timeoutMs: 1000,
		});
		expect(activeTitle.result?.title).toBe("Session A");

		await pageA.close();
		await pageB.close();
	});
});
