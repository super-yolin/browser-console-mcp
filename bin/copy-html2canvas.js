/**
 * Copy html2canvas to static resources directory
 * This script handles html2canvas as an optional dependency
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
		if (!fs.existsSync(source)) {
			console.warn(`Warning: html2canvas not found at ${source}`);
			console.warn(
				"Screenshot functionality will not be available unless html2canvas is installed.",
			);

			// Create a minimal placeholder file
			const placeholder = `
				// html2canvas is not installed
				// Install it with: pnpm add html2canvas
				console.warn("html2canvas is not installed. Screenshot functionality is disabled.");
				export default function() {
					throw new Error("html2canvas is not installed");
				}
			`;

			ensureDirectoryExists(targetDir);
			fs.writeFileSync(target, placeholder);
			console.log(`Created placeholder file at: ${target}`);
			return;
		}

		const data = fs.readFileSync(source);
		fs.writeFileSync(target, data);
		console.log(`File copied successfully: ${source} -> ${target}`);

		const duplicatePath = path.join(
			targetDir,
			"html2canvas",
			"dist",
			"html2canvas.min.js",
		);
		const duplicateDir = path.dirname(duplicatePath);

		if (fs.existsSync(duplicatePath)) {
			fs.unlinkSync(duplicatePath);

			try {
				fs.rmdirSync(duplicateDir);
				fs.rmdirSync(path.dirname(duplicateDir));
			} catch (e) {
				// Ignore non-empty directory error
			}
		}
	} catch (error) {
		console.error(`Failed to copy file: ${error.message}`);
		// Don't exit process, just warn
		console.warn("Screenshot functionality may not work correctly.");
	}
}

// Execute copy
console.log("Starting to copy html2canvas...");
ensureDirectoryExists(targetDir);
copyFile(sourcePath, targetPath);
console.log("html2canvas copy process completed");
