import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DEFAULT_TITLE = "π";
const DEFAULT_DEBOUNCE_MS = 3000;
const NOTIFY_TIMEOUT_MS = 5000;

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

function isAssistantMessage(message: unknown): message is AssistantMessageLike {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { role?: unknown }).role === "assistant"
  );
}

function getLastAssistantMessage(
  messages: readonly unknown[],
): AssistantMessageLike | undefined {
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

function buildSubtitle(hasRunError: boolean): string {
  return hasRunError ? "Agent stopped" : "Agent finished";
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
  const insideCmux = Boolean(
    process.env.CMUX_WORKSPACE_ID || process.env.CMUX_SURFACE_ID,
  );

  let lastNotificationAt = 0;
  let lastNotificationKey = "";
  let cmuxUnavailable = false;
  let reportedNotificationFailure = false;
  const debug =
    process.env.PI_CMUX_NOTIFY_DEBUG === "1" ||
    process.env.PI_CMUX_NOTIFY_DEBUG === "true";

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

  const identifySurface = async (): Promise<CmuxIdentifyResult | undefined> => {
    const surfaceId = process.env.CMUX_SURFACE_ID;
    if (!surfaceId || cmuxUnavailable) return undefined;

    const result = await pi.exec("cmux", ["identify", "--surface", surfaceId], {
      timeout: NOTIFY_TIMEOUT_MS,
    });
    if (result.killed || result.code !== 0) return undefined;

    try {
      const parsed: unknown = JSON.parse(result.stdout);
      return isCmuxIdentifyResult(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  };

  const getFocusState = async (): Promise<FocusState> => {
    if (!process.env.CMUX_SURFACE_ID || cmuxUnavailable) return "unknown";

    const cmuxFrontmost = await isCmuxFrontmost();
    if (cmuxFrontmost === false) return "unfocused";

    const identifyResult = await identifySurface();
    return identifyResult
      ? getFocusStateFromIdentify(identifyResult)
      : "unknown";
  };

  const getWorkspaceName = async (): Promise<string | undefined> => {
    const identifyResult = await identifySurface();
    const workspaceRef = identifyResult?.caller?.workspace_ref;
    if (!workspaceRef) return undefined;

    const result = await pi.exec("cmux", ["list-workspaces"], {
      timeout: NOTIFY_TIMEOUT_MS,
    });
    if (result.killed || result.code !== 0) return undefined;

    for (const line of result.stdout.split("\n")) {
      const match = line.match(
        /^\*?\s*(workspace:\d+)\s+(.+?)(?:\s+\[selected\])?$/,
      );
      if (match?.[1] === workspaceRef) return match[2].trim();
    }
    return undefined;
  };

  const sendNotification = async (
    subtitle: string,
    notificationTitle = DEFAULT_TITLE,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!insideCmux) {
      if (debug)
        console.warn(
          "[cmux-notify] not running inside cmux; skipping notification",
        );
      return { ok: true };
    }

    if (cmuxUnavailable) {
      return { ok: false, error: "cmux notify is unavailable" };
    }

    const notificationKey = `${notificationTitle}\n${subtitle}`;
    const now = Date.now();
    if (
      notificationKey === lastNotificationKey &&
      now - lastNotificationAt < DEFAULT_DEBOUNCE_MS
    ) {
      return { ok: true };
    }

    const args = [
      "notify",
      "--title",
      notificationTitle,
      "--subtitle",
      subtitle,
    ];
    const result = await pi.exec("cmux", args, { timeout: NOTIFY_TIMEOUT_MS });
    if (result.killed) {
      return { ok: false, error: "cmux notify timed out" };
    }
    if (result.code !== 0) {
      const error =
        result.stderr.trim() ||
        result.stdout.trim() ||
        `cmux exited with code ${result.code}`;
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

  pi.on("agent_end", async (event, ctx) => {
    const runFailed = hasRunError(event.messages);
    const focusState = await getFocusState();

    if (focusState !== "unfocused") {
      if (debug)
        console.warn(
          `[cmux-notify] skipped notification because focus state is ${focusState}`,
        );
      return;
    }

    const subtitle = buildSubtitle(runFailed);
    const workspaceName = await getWorkspaceName();
    const notificationTitle = workspaceName
      ? `${DEFAULT_TITLE} - ${workspaceName}`
      : DEFAULT_TITLE;
    void sendNotification(subtitle, notificationTitle)
      .then((result) => {
        if (!result.ok && result.error)
          reportNotificationFailure(result.error, ctx);
      })
      .catch((error: unknown) => {
        reportNotificationFailure(
          error instanceof Error ? error.message : String(error),
          ctx,
        );
      });
  });
}
