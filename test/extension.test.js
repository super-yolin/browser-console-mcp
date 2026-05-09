import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Chrome extension manifest wires background and content scripts", async () => {
	const manifest = JSON.parse(
		await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"),
	);

	assert.equal(manifest.manifest_version, 3);
	assert.equal(manifest.background.service_worker, "background.js");
	assert.equal(manifest.background.type, "module");
	assert.equal(manifest.content_scripts[0].js[0], "content-script.js");
	assert.deepEqual(manifest.host_permissions, ["http://*/*", "https://*/*"]);
});

test("Chrome extension content script injects extension-mode page agent", async () => {
	const contentScript = await readFile(
		new URL("../extension/content-script.js", import.meta.url),
		"utf8",
	);
	const background = await readFile(
		new URL("../extension/background.js", import.meta.url),
		"utf8",
	);

	assert.match(contentScript, /mode=extension/);
	assert.match(contentScript, /serverUrl=/);
	assert.match(contentScript, /browser-console-mcp\.js/);
	assert.match(background, /chrome\.tabs\.onUpdated/);
	assert.match(background, /chrome\.scripting\.executeScript/);
});
