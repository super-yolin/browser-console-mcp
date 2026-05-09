import typescript from "@rollup/plugin-typescript";

export default {
	input: "src/mcp/adapter.ts",
	output: {
		file: "dist/mcp/adapter.js",
		format: "es",
		sourcemap: true,
	},
	// All node_modules are available at runtime; no need to bundle them.
	external: (id) => !id.startsWith(".") && !id.startsWith("/") && !id.startsWith("node:"),
	plugins: [
		typescript({
			tsconfig: "./tsconfig.browser.json",
			sourceMap: true,
			inlineSources: true,
		}),
	],
};
