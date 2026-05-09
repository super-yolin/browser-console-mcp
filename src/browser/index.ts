import { startDaemon } from "../daemon/index";

const daemon = await startDaemon();

const shutdown = async () => {
	await daemon.stop();
	process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (error) => {
	console.error("[BCM] Uncaught exception:", error);
});
process.on("unhandledRejection", (reason) => {
	console.error("[BCM] Unhandled Promise rejection:", reason);
});
