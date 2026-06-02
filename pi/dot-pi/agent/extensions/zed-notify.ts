/**
 * @file Notifies when Zed-hosted pi agent runs finish in the background.
 *
 * Checks whether Zed is frontmost and focused on pi's cwd, sends a macOS
 * notification when the relevant workspace is unfocused, and opens that
 * workspace in Zed when the notification is clicked.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { complete } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DEFAULT_TITLE = "π";
const ZED_BUNDLE_ID = "dev.zed.Zed";
const DEFAULT_DEBOUNCE_MS = 1000;
const NOTIFY_TIMEOUT_MS = 5000;
const NOTIFICATION_GROUP_PREFIX = "pi-zed-notify";

interface MessageLike {
  role?: string;
  content?: unknown;
  stopReason?: string;
}

interface TextContentBlock {
  type?: string;
  text?: string;
}

type FocusState = "focused" | "unfocused" | "unknown";

type ZedActiveWorkspaceRow = {
  workspace_paths: string | null;
};

type ZedProject = {
  name: string;
  path: string;
  paths: string[];
};

function isMessage(message: unknown): message is MessageLike {
  return typeof message === "object" && message !== null;
}

function isAssistantMessage(message: unknown): message is MessageLike {
  return isMessage(message) && message.role === "assistant";
}

function getLastAssistantMessage(
  messages: readonly unknown[],
): MessageLike | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (isAssistantMessage(message)) return message;
  }
  return undefined;
}

function hasRunError(messages: readonly unknown[]): boolean {
  const assistantMessage = getLastAssistantMessage(messages);
  return Boolean(
    assistantMessage &&
    (assistantMessage.stopReason === "error" ||
      assistantMessage.stopReason === "aborted"),
  );
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is TextContentBlock =>
        typeof part === "object" &&
        part !== null &&
        (part as TextContentBlock).type === "text" &&
        typeof (part as TextContentBlock).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

function getLastTurn(messages: readonly unknown[]): string {
  const turn: string[] = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isMessage(message)) continue;
    if (message.role !== "user" && message.role !== "assistant") continue;

    const text = extractText(message.content).trim();
    if (!text) continue;
    turn.unshift(`${message.role}: ${text}`);
    if (message.role === "user") break;
  }
  return turn.join("\n\n");
}

function sanitizeSummary(summary: string): string {
  return summary
    .replace(/[\r\n]+/g, " ")
    .replace(/^['"“”‘’`]+|['"“”‘’`]+$/g, "")
    .trim()
    .slice(0, 80);
}

function buildFallbackSubtitle(hasRunError: boolean): string {
  return hasRunError ? "Agent stopped" : "Agent finished";
}

async function buildSubtitle(
  messages: readonly unknown[],
  ctx: {
    model?: unknown;
    modelRegistry?: {
      getApiKeyAndHeaders?: (model: unknown) => Promise<
        | { ok: true; apiKey?: string; headers?: Record<string, string> }
        | { ok: false; error: string }
      >;
    };
  },
): Promise<string> {
  const fallback = buildFallbackSubtitle(hasRunError(messages));
  const lastTurn = getLastTurn(messages);
  if (!lastTurn || !ctx.model || !ctx.modelRegistry?.getApiKeyAndHeaders)
    return fallback;

  try {
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
    if (!auth.ok || !auth.apiKey) return fallback;

    const response = await complete(
      ctx.model as Parameters<typeof complete>[0],
      {
        messages: [
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: [
                  "Write a very short macOS notification summary of this last AI coding-agent turn.",
                  "Return only the summary, 2-6 words, no punctuation unless needed.",
                  "Prefer what changed or what happened over generic status words.",
                  "",
                  lastTurn,
                ].join("\n"),
              },
            ],
            timestamp: Date.now(),
          },
        ],
      },
      {
        apiKey: auth.apiKey,
        headers: auth.headers,
        reasoningEffort: "minimal",
      },
    );

    const summary = sanitizeSummary(
      response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join(" "),
    );
    return summary || fallback;
  } catch {
    return fallback;
  }
}

function buildTitle(projectName: string | undefined): string {
  return projectName ? `${DEFAULT_TITLE} - ${projectName}` : DEFAULT_TITLE;
}

function encodeFilePathForUrl(filePath: string): string {
  return filePath
    .split(path.sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildZedOpenUrl(cwd: string | undefined): string {
  return cwd
    ? `zed://file${encodeFilePathForUrl(path.resolve(cwd))}`
    : "zed://open";
}

function buildNotificationGroup(projectPath: string | undefined): string {
  return projectPath
    ? `${NOTIFICATION_GROUP_PREFIX}:${path.resolve(projectPath)}`
    : NOTIFICATION_GROUP_PREFIX;
}

function resolveZedDbPath(): string | undefined {
  const home = os.homedir();
  return [
    process.env.PI_ZED_DB,
    process.env.OPENCODE_ZED_DB,
    path.join(home, "Library/Application Support/Zed/db/0-stable/db.sqlite"),
    path.join(home, ".local/share/zed/db/0-stable/db.sqlite"),
  ].find((candidate): candidate is string => {
    if (!candidate) return false;
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

function workspacePaths(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed))
      return parsed.filter((v) => typeof v === "string");
  } catch {}
  return value.split(/\n|\0/).filter(Boolean);
}

function scoreWorkspace(
  paths: readonly string[],
  cwd: string | undefined,
): number {
  if (!cwd) return -1;
  const resolvedCwd = path.resolve(cwd);
  let best = -1;
  for (const p of paths) {
    const ws = path.resolve(p);
    const rel = path.relative(ws, resolvedCwd);
    if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel)))
      best = Math.max(best, ws.length);
  }
  return best;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function isMacOS(): boolean {
  return process.platform === "darwin";
}

function isZedTerminal(): boolean {
  return (
    process.env.ZED_TERM === "true" ||
    process.env.TERM_PROGRAM?.toLowerCase() === "zed"
  );
}

export default function zedNotifyExtension(pi: ExtensionAPI) {
  let lastNotificationAt = 0;
  let lastNotificationKey = "";
  let reportedNotificationFailure = false;
  const debug =
    process.env.PI_ZED_NOTIFY_DEBUG === "1" ||
    process.env.PI_ZED_NOTIFY_DEBUG === "true";

  const reportNotificationFailure = (
    error: string,
    ctx?: {
      ui?: {
        notify?: (
          message: string,
          level?: "info" | "warning" | "error",
        ) => void;
      };
    },
  ) => {
    if (debug) console.warn(`[zed-notify] ${error}`);
    if (reportedNotificationFailure) return;
    reportedNotificationFailure = true;
    ctx?.ui?.notify?.(`Zed notification failed: ${error}`, "warning");
  };

  const getFrontmostAppBundleId = async (): Promise<string | undefined> => {
    const result = await pi.exec(
      "osascript",
      ["-e", "id of application (path to frontmost application as text)"],
      { timeout: NOTIFY_TIMEOUT_MS },
    );
    if (result.killed || result.code !== 0) return undefined;
    return result.stdout.trim() || undefined;
  };

  const getFocusState = async (
    cwd: string | undefined,
  ): Promise<FocusState> => {
    if (!isMacOS()) return "unknown";

    const frontmostBundleId = await getFrontmostAppBundleId();
    if (!frontmostBundleId) return "unknown";
    if (frontmostBundleId !== ZED_BUNDLE_ID) return "unfocused";

    const activeProject = await getActiveZedProject();
    if (!activeProject) return "focused";

    return scoreWorkspace(activeProject.paths, cwd) >= 0
      ? "focused"
      : "unfocused";
  };

  const getActiveZedProject = async (): Promise<ZedProject | undefined> => {
    const dbPath = resolveZedDbPath();
    if (!dbPath) return undefined;

    const result = await pi.exec(
      "sqlite3",
      [
        "-readonly",
        "-json",
        dbPath,
        `with front_window as (
  select json_extract(value, '$[#-1]') as window_id
  from kv_store
  where key = 'session_window_stack'
), active_workspace as (
  select json_extract(value, '$.active_workspace_id') as workspace_id
  from scoped_kv_store
  where namespace = 'multi_workspace_state'
    and key = (select window_id from front_window)
)
select w.paths as workspace_paths
from workspaces w
where w.workspace_id = (select workspace_id from active_workspace)`,
      ],
      { timeout: NOTIFY_TIMEOUT_MS },
    );
    if (result.killed || result.code !== 0) return undefined;

    let rows: ZedActiveWorkspaceRow[];
    try {
      rows = result.stdout.trim()
        ? (JSON.parse(result.stdout) as ZedActiveWorkspaceRow[])
        : [];
    } catch {
      return undefined;
    }

    const candidate = rows
      .map((row) => ({ paths: workspacePaths(row.workspace_paths) }))
      .find((row) => row.paths.length > 0);

    const projectPath = candidate?.paths[0];
    if (!projectPath) return undefined;
    return {
      name: path.basename(projectPath),
      path: projectPath,
      paths: candidate.paths,
    };
  };

  const sendNotification = async (
    subtitle: string,
    notificationTitle = DEFAULT_TITLE,
    zedOpenUrl = "zed://open",
    notificationGroup = NOTIFICATION_GROUP_PREFIX,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!isZedTerminal() && process.env.PI_ZED_NOTIFY_FORCE !== "1") {
      if (debug)
        console.warn(
          "[zed-notify] not running inside Zed; skipping notification",
        );
      return { ok: true };
    }

    const notificationKey = `${notificationTitle}\n${subtitle}`;
    const now = Date.now();
    if (
      notificationKey === lastNotificationKey &&
      now - lastNotificationAt < DEFAULT_DEBOUNCE_MS
    ) {
      return { ok: true };
    }

    if (!isMacOS()) return { ok: false, error: "only macOS is supported" };

    const alerterExists = await pi.exec("sh", ["-c", "command -v alerter"], {
      timeout: NOTIFY_TIMEOUT_MS,
    });
    if (alerterExists.killed)
      return { ok: false, error: "alerter lookup timed out" };
    if (alerterExists.code !== 0)
      return { ok: false, error: "alerter not found" };

    const alerterCommand = [
      "alerter",
      "--title",
      notificationTitle,
      "--message",
      subtitle,
      "--sender",
      ZED_BUNDLE_ID,
      "--group",
      notificationGroup,
    ]
      .map(shellQuote)
      .join(" ");
    const openCommand = ["open", zedOpenUrl].map(shellQuote).join(" ");
    const command = `result=$(${alerterCommand}); case "$result" in @ACTIONCLICKED|@CONTENTCLICKED) ${openCommand} ;; esac`;

    const result = await pi.exec("sh", ["-c", `${command} >/dev/null 2>&1 &`], {
      timeout: NOTIFY_TIMEOUT_MS,
    });

    lastNotificationAt = now;
    lastNotificationKey = notificationKey;

    if (result.killed) return { ok: false, error: "alerter timed out" };
    if (result.code !== 0) {
      return {
        ok: false,
        error:
          result.stderr.trim() ||
          result.stdout.trim() ||
          `alerter exited with code ${result.code}`,
      };
    }

    return { ok: true };
  };

  pi.on("agent_end", async (event, ctx) => {
    const focusState = await getFocusState(ctx.cwd);
    if (focusState !== "unfocused") {
      if (debug)
        console.warn(
          `[zed-notify] skipped notification because focus state is ${focusState}`,
        );
      return;
    }

    const projectName = ctx.cwd ? path.basename(ctx.cwd) : undefined;
    const title = buildTitle(projectName);
    try {
      const subtitle = await buildSubtitle(event.messages, ctx);
      const result = await sendNotification(
        subtitle,
        title,
        buildZedOpenUrl(ctx.cwd),
        buildNotificationGroup(ctx.cwd),
      );
      if (!result.ok && result.error)
        reportNotificationFailure(result.error, ctx);
    } catch (error: unknown) {
      reportNotificationFailure(
        error instanceof Error ? error.message : String(error),
        ctx,
      );
    }
  });
}
