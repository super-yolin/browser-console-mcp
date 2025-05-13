/**
 * Copy html2canvas to static resources directory
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
	"node_modules",
	"html2canvas",
	"dist",
	"html2canvas.min.js",
);

// Target directory
const targetDir = path.join(projectRoot, "dist", "static");
const targetPath = path.join(targetDir, "html2canvas.min.js");

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
		const data = fs.readFileSync(source);
		fs.writeFileSync(target, data);
		console.log(`File copied successfully: ${source} -> ${target}`);
	} catch (error) {
		console.error(`Failed to copy file: ${error.message}`);
		process.exit(1);
	}
}

// Execute copy
console.log("Starting to copy html2canvas...");
ensureDirectoryExists(targetDir);
copyFile(sourcePath, targetPath);
console.log("html2canvas copy completed");
