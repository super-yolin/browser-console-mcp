import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default {
	input: "src/browser/index.ts",
	output: {
		file: "dist/browser/index.js",
		format: "es",
		sourcemap: true,
	},
	plugins: [
		resolve(),
		commonjs(),
		typescript({
			tsconfig: "./tsconfig.browser.json",
			sourceMap: true,
			inlineSources: true,
		}),
		terser(),
	],
};
