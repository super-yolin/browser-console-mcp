const DAEMON_HTTP_URL = "http://localhost:7898";

async function ensureDaemonReachable() {
	try {
		const response = await fetch(`${DAEMON_HTTP_URL}/health`);
		return response.ok;
	} catch {
		return false;
	}
}

async function reinjectTab(tabId) {
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			files: ["content-script.js"],
		});
	} catch {
		// Some browser pages, extension pages, or restricted sites cannot be scripted.
	}
}

chrome.runtime.onInstalled.addListener(async () => {
	await ensureDaemonReachable();
});

chrome.action.onClicked.addListener(async (tab) => {
	if (tab.id) await reinjectTab(tab.id);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status !== "complete" || !tab.url?.startsWith("http")) return;
	await reinjectTab(tabId);
});

chrome.runtime.onMessage.addListener((message, sender) => {
	if (!sender.tab?.id) return;
	if (message?.type === "page:navigated" || message?.type === "page:closing") {
		fetch(`${DAEMON_HTTP_URL}/health`).catch(() => undefined);
	}
});
