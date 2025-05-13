#!/usr/bin/env node

/**
 * Browser MCP Server CLI
 *
 * Command line entry point for the browser MCP server
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// Command line arguments
const args = process.argv.slice(2);
const port =
	args.find((arg) => !arg.startsWith("-")) || process.env.PORT || "7898";

// Set environment variables
process.env.PORT = port;

// Ensure stdout is only used for JSON messages
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, encoding, callback) => {
	// Only allow JSON messages through
	if (typeof chunk === "string" && !chunk.startsWith("{")) {
		process.stderr.write(chunk); // Redirect non-JSON messages to stderr
		return true;
	}
	return originalStdoutWrite(chunk, encoding, callback);
};

// Start browser MCP server
console.error(`Starting Browser MCP server, listening on port ${port}...`);

// Ensure stdio is correctly passed
const child = spawn("node", [join(rootDir, "dist/browser/index.js")], {
	stdio: ["inherit", "inherit", "inherit"], // Ensure stdin, stdout, stderr are all correctly passed
	env: { ...process.env, PORT: port },
});

// Handle child process events
child.on("error", (err) => {
	console.error("Failed to start child process:", err);
	process.exit(1);
});

child.on("exit", (code, signal) => {
	if (code !== null) {
		console.error(`Child process exited with code: ${code}`);
	} else if (signal !== null) {
		console.error(`Child process terminated by signal: ${signal}`);
	}
	process.exit(code || 0);
});

// Pass parent process signals to child process
process.on("SIGINT", () => {
	child.kill("SIGINT");
});

process.on("SIGTERM", () => {
	child.kill("SIGTERM");
});

// Handle parent process exit
process.on("exit", () => {
	if (!child.killed) {
		child.kill();
	}
});
