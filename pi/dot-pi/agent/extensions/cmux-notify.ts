import type { ExtensionAPI, ToolResultEvent } from "@earendil-works/pi-coding-agent";
import {
	isBashToolResult,
	isEditToolResult,
	isFindToolResult,
	isGrepToolResult,
	isReadToolResult,
	isWriteToolResult,
} from "@earendil-works/pi-coding-agent";
import { basename } from "node:path";

const DEFAULT_DEBOUNCE_MS = 3000;
const NOTIFY_TIMEOUT_MS = 5000;
const DEFAULT_NOTIFY_LEVEL = "medium";

type NotifyLevel = "all" | "medium" | "low" | "disabled";

interface RunState {
	startedAt: number;
	readFiles: Set<string>;
	changedFiles: Set<string>;
	searchCount: number;
	bashCount: number;
	firstToolError: string | undefined;
}

interface AssistantMessageLike {
	role: "assistant";
	stopReason?: string;
	errorMessage?: string;
	content?: Array<{ type?: string; text?: string }>;
}

interface CmuxSurfaceLike {
	surface_ref?: string;
	workspace_ref?: string;
}

interface CmuxIdentifyResult {
	caller?: CmuxSurfaceLike | null;
	focused?: CmuxSurfaceLike | null;
}

type FocusState = "focused" | "unfocused" | "unknown";

function getNumberFromEnv(name: string, fallback: number): number {
	const value = process.env[name];
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getNotifyLevelFromEnv(): NotifyLevel {
	const value = process.env.PI_CMUX_NOTIFY_LEVEL?.trim().toLowerCase();
	if (value === "all" || value === "medium" || value === "low" || value === "disabled") {
		return value;
	}
	return DEFAULT_NOTIFY_LEVEL;
}

function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
	return count === 1 ? singular : plural;
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.max(1, Math.round(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes === 0) return `${seconds}s`;
	if (seconds === 0) return `${minutes}m`;
	return `${minutes}m ${seconds}s`;
}

function getPathFromInput(event: ToolResultEvent): string | undefined {
	const input = event.input as { path?: unknown };
	const path = input.path;
	return typeof path === "string" && path.length > 0 ? path : undefined;
}

function getFirstText(event: ToolResultEvent): string | undefined {
	const textPart = event.content.find((part) => part.type === "text");
	if (!textPart || textPart.type !== "text") return undefined;
	const text = textPart.text.trim();
	return text.length > 0 ? text : undefined;
}

function summarizeError(event: ToolResultEvent): string {
	const path = getPathFromInput(event);
	if (path) {
		return `${event.toolName} failed for ${basename(path)}`;
	}
	if (isBashToolResult(event)) {
		return "bash command failed";
	}
	const text = getFirstText(event);
	if (!text) {
		return `${event.toolName} failed`;
	}
	return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function summarizeSuccess(state: RunState, durationMs: number): string {
	const duration = formatDuration(durationMs);
	const changedCount = state.changedFiles.size;
	if (changedCount === 1) {
		const [file] = [...state.changedFiles];
		return `Updated ${basename(file)} in ${duration}`;
	}
	if (changedCount > 1) {
		return `Updated ${changedCount} ${pluralize(changedCount, "file")} in ${duration}`;
	}

	const readCount = state.readFiles.size;
	if (readCount === 1) {
		const [file] = [...state.readFiles];
		return `Reviewed ${basename(file)} in ${duration}`;
	}
	if (readCount > 1) {
		return `Reviewed ${readCount} ${pluralize(readCount, "file")} in ${duration}`;
	}

	if (state.searchCount > 0 && state.bashCount > 0) {
		return `Ran ${state.searchCount} ${pluralize(state.searchCount, "search")} and ${state.bashCount} ${pluralize(state.bashCount, "shell command")} in ${duration}`;
	}
	if (state.searchCount > 0) {
		const summary = state.searchCount === 1 ? "Searched the codebase" : `Ran ${state.searchCount} searches`;
		return `${summary} in ${duration}`;
	}
	if (state.bashCount > 0) {
		return `Ran ${state.bashCount} ${pluralize(state.bashCount, "shell command")} in ${duration}`;
	}
	return `Finished in ${duration}`;
}

function isAssistantMessage(message: unknown): message is AssistantMessageLike {
	return typeof message === "object" && message !== null && (message as { role?: unknown }).role === "assistant";
}

function getLastAssistantMessage(messages: readonly unknown[]): AssistantMessageLike | undefined {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (isAssistantMessage(message)) return message;
	}
	return undefined;
}

function summarizeAssistantText(message: AssistantMessageLike): string | undefined {
	if (!Array.isArray(message.content)) return undefined;

	const text = message.content
		.filter(
			(part): part is { type: "text"; text: string } =>
				typeof part === "object" &&
				part !== null &&
				part.type === "text" &&
				typeof part.text === "string" &&
				part.text.trim().length > 0,
		)
		.map((part) => part.text.trim())
		.join("\n")
		.trim();

	if (text.length === 0) return undefined;
	return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function summarizeRunError(messages: readonly unknown[], fallbackError?: string): string | undefined {
	const assistantMessage = getLastAssistantMessage(messages);
	if (!assistantMessage) return fallbackError;
	if (assistantMessage.stopReason !== "error" && assistantMessage.stopReason !== "aborted") {
		return fallbackError;
	}

	const summary = assistantMessage.errorMessage?.trim() || summarizeAssistantText(assistantMessage) || fallbackError || "Agent run failed";
	return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
}

function buildSubtitle(hasRunError: boolean): string {
	return hasRunError ? "Error" : "Task Complete";
}

function shouldNotify(level: NotifyLevel): boolean {
	return level !== "disabled";
}

function createEmptyRunState(): RunState {
	return {
		startedAt: Date.now(),
		readFiles: new Set<string>(),
		changedFiles: new Set<string>(),
		searchCount: 0,
		bashCount: 0,
		firstToolError: undefined,
	};
}

function isCmuxIdentifyResult(value: unknown): value is CmuxIdentifyResult {
	return typeof value === "object" && value !== null;
}

function getFocusStateFromIdentify(result: CmuxIdentifyResult): FocusState {
	const callerSurface = result.caller?.surface_ref;
	const focusedSurface = result.focused?.surface_ref;
	if (!callerSurface || !focusedSurface) return "unknown";
	return callerSurface === focusedSurface ? "focused" : "unfocused";
}

function isMacOS(): boolean {
	return process.platform === "darwin";
}

export default function cmuxNotifyExtension(pi: ExtensionAPI) {
	const debounceMs = getNumberFromEnv("PI_CMUX_NOTIFY_DEBOUNCE_MS", DEFAULT_DEBOUNCE_MS);
	const notifyLevel = getNotifyLevelFromEnv();
	const title = process.env.PI_CMUX_NOTIFY_TITLE || "Pi";
	const insideCmux = Boolean(process.env.CMUX_WORKSPACE_ID || process.env.CMUX_SURFACE_ID);

	let runState = createEmptyRunState();
	let lastNotificationAt = 0;
	let lastNotificationKey = "";
	let cmuxUnavailable = false;
	let reportedNotificationFailure = false;
	const debug = process.env.PI_CMUX_NOTIFY_DEBUG === "1" || process.env.PI_CMUX_NOTIFY_DEBUG === "true";

	const reportNotificationFailure = (error: string, ctx?: { ui?: { notify?: (message: string, level?: "info" | "warning" | "error") => void } }) => {
		if (debug) console.warn(`[cmux-notify] ${error}`);
		if (reportedNotificationFailure) return;
		reportedNotificationFailure = true;
		ctx?.ui?.notify?.(`cmux notification failed: ${error}`, "warning");
	};

	const isCmuxFrontmost = async (): Promise<boolean | undefined> => {
		if (!isMacOS()) return undefined;

		const result = await pi.exec(
			"osascript",
			["-e", "id of application (path to frontmost application as text)"],
			{ timeout: NOTIFY_TIMEOUT_MS },
		);
		if (result.killed || result.code !== 0) return undefined;

		const frontmostBundleId = result.stdout.trim();
		if (!frontmostBundleId) return undefined;
		return frontmostBundleId === process.env.CMUX_BUNDLE_ID;
	};

	const getFocusState = async (): Promise<FocusState> => {
		const surfaceId = process.env.CMUX_SURFACE_ID;
		if (!surfaceId || cmuxUnavailable) return "unknown";

		const cmuxFrontmost = await isCmuxFrontmost();
		if (cmuxFrontmost === false) return "unfocused";

		const result = await pi.exec("cmux", ["identify", "--surface", surfaceId], { timeout: NOTIFY_TIMEOUT_MS });
		if (result.killed || result.code !== 0) return "unknown";

		try {
			const parsed: unknown = JSON.parse(result.stdout);
			if (!isCmuxIdentifyResult(parsed)) return "unknown";
			return getFocusStateFromIdentify(parsed);
		} catch {
			return "unknown";
		}
	};

	const sendNotification = async (subtitle: string, body: string): Promise<{ ok: boolean; error?: string }> => {
		if (!insideCmux) {
			if (debug) console.warn("[cmux-notify] not running inside cmux; skipping notification");
			return { ok: true };
		}

		if (cmuxUnavailable) {
			return { ok: false, error: "cmux notify is unavailable" };
		}

		const notificationKey = `${subtitle}\n${body}`;
		const now = Date.now();
		if (notificationKey === lastNotificationKey && now - lastNotificationAt < debounceMs) {
			return { ok: true };
		}

		const args = ["notify", "--title", title, "--subtitle", subtitle, "--body", body];
		const result = await pi.exec("cmux", args, { timeout: NOTIFY_TIMEOUT_MS });
		if (result.killed) {
			return { ok: false, error: "cmux notify timed out" };
		}
		if (result.code !== 0) {
			const error = result.stderr.trim() || result.stdout.trim() || `cmux exited with code ${result.code}`;
			const normalizedError = error.toLowerCase();
			if (
				normalizedError.includes("not found") ||
				normalizedError.includes("enoent") ||
				normalizedError.includes("no such file")
			) {
				cmuxUnavailable = true;
			}
			lastNotificationAt = now;
			lastNotificationKey = notificationKey;
			return { ok: false, error };
		}

		lastNotificationAt = now;
		lastNotificationKey = notificationKey;
		return { ok: true };
	};

	pi.on("agent_start", async () => {
		runState = createEmptyRunState();
	});

	pi.on("tool_result", async (event) => {
		if (event.isError && !runState.firstToolError) {
			runState.firstToolError = summarizeError(event);
		}

		if (isReadToolResult(event)) {
			const path = getPathFromInput(event);
			if (path) runState.readFiles.add(path);
			return;
		}

		if (isEditToolResult(event) || isWriteToolResult(event)) {
			const path = getPathFromInput(event);
			if (path && !event.isError) runState.changedFiles.add(path);
			return;
		}

		if (isGrepToolResult(event) || isFindToolResult(event)) {
			if (!event.isError) runState.searchCount += 1;
			return;
		}

		if (isBashToolResult(event) && !event.isError) {
			runState.bashCount += 1;
		}
	});

	pi.on("agent_end", async (event, ctx) => {
		const durationMs = Date.now() - runState.startedAt;
		const runError = summarizeRunError(event.messages, runState.firstToolError);
		const focusState = await getFocusState();

		if (focusState !== "unfocused") {
			if (debug) console.warn(`[cmux-notify] skipped notification because focus state is ${focusState}`);
			return;
		}

		const subtitle = buildSubtitle(Boolean(runError));
		if (!shouldNotify(notifyLevel)) {
			return;
		}
		const body = runError || summarizeSuccess(runState, durationMs);
		void sendNotification(subtitle, body)
			.then((result) => {
				if (!result.ok && result.error) reportNotificationFailure(result.error, ctx);
			})
			.catch((error: unknown) => {
				reportNotificationFailure(error instanceof Error ? error.message : String(error), ctx);
			});
	});

}
