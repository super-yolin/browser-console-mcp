import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default {
	input: "src/client/index.ts",
	output: {
		file: "dist/client/browser-console-mcp.js",
		format: "iife",
		name: "BrowserConsoleMCP",
		sourcemap: true,
	},
	plugins: [
		resolve(),
		commonjs(),
		typescript({
			tsconfig: "./tsconfig.client.json",
		}),
		terser(),
	],
};
