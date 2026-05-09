import { expect, test, type Page } from "@playwright/test";
import { startDaemon, type BrowserConsoleDaemon } from "../dist/browser/index.js";

async function stubHtml2Canvas(page: Page): Promise<void> {
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

async function injectConsoleClient(page: Page, port: number): Promise<void> {
	await page.goto(`http://127.0.0.1:${port}/__e2e_console`);
	await page.setContent("<!doctype html><title>Console Entry</title><button id='btn'>Click</button>");
	await stubHtml2Canvas(page);
	await page.addScriptTag({ url: `http://127.0.0.1:${port}/browser-inject.js` });
	await expect
		.poll(() => page.evaluate(() => window.mcp?.status().connected))
		.toBe(true);
}

test.describe("console injection entry", () => {
	let daemon: BrowserConsoleDaemon;
	const port = 19200;

	test.beforeEach(async () => {
		daemon = await startDaemon({ port, writeRuntime: false });
	});

	test.afterEach(async () => {
		await daemon.stop();
	});

	test("connects a real browser page and executes page commands", async ({ page }) => {
		await injectConsoleClient(page, port);

		const status = await page.evaluate(() => window.mcp.status());
		expect(status.mode).toBe("console");
		expect(status.title).toBe("Console Entry");

		const title = await daemon.sendBrowserRequest({
			type: "get_page_title",
			timeoutMs: 1000,
		});
		expect(title.ok).toBe(true);
		expect(title.result?.title).toBe("Console Entry");

		const exec = await daemon.sendBrowserRequest({
			type: "execute_js",
			payload: { code: "return document.querySelector('#btn').id" },
			timeoutMs: 1000,
		});
		expect(exec.ok).toBe(true);
		expect(exec.result?.result).toBe('"btn"');
	});

	test("captures console logs and network requests", async ({ page }) => {
		await injectConsoleClient(page, port);

		await daemon.sendBrowserRequest({
			type: "clear_browser_diagnostics",
			timeoutMs: 1000,
		});

		await daemon.sendBrowserRequest({
			type: "execute_js",
			payload: {
				code: "console.error('bcm e2e error'); fetch('/__bcm_diagnostics').catch(() => {}); return true;",
			},
			timeoutMs: 1000,
		});

		await expect
			.poll(async () => {
				const logs = await daemon.sendBrowserRequest({
					type: "get_console_logs",
					payload: { level: "error" },
					timeoutMs: 1000,
				});
				return JSON.stringify(logs.result?.logs ?? []);
			})
			.toContain("bcm e2e error");

		await expect
			.poll(async () => {
				const requests = await daemon.sendBrowserRequest({
					type: "get_network_requests",
					timeoutMs: 1000,
				});
				return JSON.stringify(requests.result?.requests ?? []);
			})
			.toContain("__bcm_diagnostics");
	});

	test("reconnects after daemon restart on the same port", async ({ page }) => {
		await injectConsoleClient(page, port);

		await daemon.stop();
		daemon = await startDaemon({ port, writeRuntime: false });

		await expect
			.poll(async () => {
				const response = await daemon.sendBrowserRequest({
					type: "get_page_title",
					timeoutMs: 500,
				});
				return response.ok ? response.result?.title : null;
			}, { timeout: 8000 })
			.toBe("Console Entry");
	});
});
