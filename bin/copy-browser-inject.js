/**
 * Copy browser-inject.js to dist/browser directory
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Source file path
const sourcePath = path.join(
	projectRoot,
	"src",
	"browser",
	"browser-inject.js",
);

// Target directory
const targetDir = path.join(projectRoot, "dist", "browser");
const targetPath = path.join(targetDir, "browser-inject.js");

// Ensure target directory exists
function ensureDirectoryExists(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
		console.log(`Creating directory: ${dirPath}`);
	}
}

// Copy file
function copyFile(source, target) {
	try {
		if (!fs.existsSync(source)) {
			console.error(`Error: Source file not found: ${source}`);
			process.exit(1);
		}

		const data = fs.readFileSync(source);
		fs.writeFileSync(target, data);
		console.log(`File copied successfully: ${source} -> ${target}`);
	} catch (error) {
		console.error(`Failed to copy file: ${error.message}`);
		process.exit(1);
	}
}

// Execute copy
console.log("Starting to copy browser-inject.js...");
ensureDirectoryExists(targetDir);
copyFile(sourcePath, targetPath);
console.log("browser-inject.js copy completed");
