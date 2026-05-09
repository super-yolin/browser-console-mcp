import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type RuntimeState = {
	pid: number;
	port: number;
	startedAt: number;
	version: string;
	token: string;
};

export const RUNTIME_PATH = join(
	homedir(),
	".browser-console-mcp",
	"runtime.json",
);

export async function readRuntimeState(): Promise<RuntimeState | null> {
	try {
		const content = await readFile(RUNTIME_PATH, "utf8");
		return JSON.parse(content) as RuntimeState;
	} catch {
		return null;
	}
}

export async function writeRuntimeState(state: RuntimeState): Promise<void> {
	await mkdir(dirname(RUNTIME_PATH), { recursive: true });
	await writeFile(RUNTIME_PATH, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
}

export async function clearRuntimeState(): Promise<void> {
	await rm(RUNTIME_PATH, { force: true });
}
