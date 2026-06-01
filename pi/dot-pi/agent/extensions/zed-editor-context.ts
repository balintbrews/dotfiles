import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

type Position = { line: number; character: number };
type EditorSelectionRange = {
  text: string;
  selection: { start: Position; end: Position };
};
type EditorSelection = {
  filePath: string;
  source: "zed";
  ranges: EditorSelectionRange[];
};
type ZedSelectionResult =
  | { type: "selection"; selection: EditorSelection }
  | { type: "empty" }
  | { type: "workspace_mismatch" }
  | { type: "unavailable"; reason?: string };
type ActiveRow = {
  item_kind: string;
  editor_id: number | string | null;
  workspace_id: number | string;
  workspace_paths: string | null;
  timestamp: number | string | null;
  buffer_path: string | null;
  pane_active: number | string | null;
};
type FileCacheEntry = { mtimeMs: number; size: number; text: string };

type SelectionState = {
  enabled: boolean;
  status: "disabled" | "connected" | "unavailable";
  selection?: EditorSelection;
  selectionKey?: string;
  sentSelectionKey?: string;
  lastError?: string;
  lastPollAt?: Date;
  dbPath?: string;
};

const state: SelectionState = { enabled: true, status: "disabled" };
const fileCache = new Map<string, FileCacheEntry>();
const encoder = new TextEncoder();
let timer: NodeJS.Timeout | undefined;
let inFlight: Promise<void> | undefined;
let pollGeneration = 0;
let lastContext: ExtensionContext | undefined;

const pollMs = () => envNumber("PI_ZED_CONTEXT_POLL_MS", 1000, 100);
const debug = () => process.env.PI_ZED_CONTEXT_DEBUG === "1";
const maxFileBytes = () =>
  envNumber("PI_ZED_CONTEXT_MAX_FILE_BYTES", 2 * 1024 * 1024, 0);
const maxSelectionChars = () =>
  envNumber("PI_ZED_CONTEXT_MAX_SELECTION_CHARS", 20_000, 0);

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => startPolling(ctx));
  pi.on("resources_discover", async (_event, ctx) => startPolling(ctx));
  pi.on("session_shutdown", async () => {
    clearSelection();
    stopPolling();
    updateStatus();
  });

  pi.on("before_agent_start", async () => {
    if (!state.enabled || !state.selection || !state.selectionKey) return;
    if (state.selectionKey === state.sentSelectionKey) return;
    state.sentSelectionKey = state.selectionKey;
    updateStatus();
    return {
      message: {
        customType: "zed-editor-context",
        content: formatEditorContext(state.selection),
        display: false,
        details: {
          source: "zed",
          filePath: state.selection.filePath,
          ranges: state.selection.ranges,
        },
      },
    };
  });

  pi.registerCommand("zed-context-toggle", {
    description: "Toggle automatic Zed editor context",
    handler: async (_args, ctx) => {
      state.enabled = !state.enabled;
      if (state.enabled) startPolling(ctx);
      else {
        clearSelection();
        stopPolling();
      }
      ctx.ui.notify(
        `Zed context ${state.enabled ? "enabled" : "disabled"}`,
        "info",
      );
      updateStatus();
    },
  });

  pi.registerCommand("zed-context-clear", {
    description: "Clear pending Zed editor context",
    handler: async (_args, ctx) => {
      state.sentSelectionKey = state.selectionKey;
      ctx.ui.notify("Zed editor context cleared", "info");
      updateStatus();
    },
  });

  pi.registerCommand("zed-context-status", {
    description: "Show Zed editor context status",
    handler: async (_args, ctx) =>
      ctx.ui.notify(statusText(ctx), state.lastError ? "warning" : "info"),
  });
}

function startPolling(ctx: ExtensionContext) {
  lastContext = ctx;
  if (!state.enabled) return;
  if (!isZedTerminal() && process.env.PI_ZED_CONTEXT_FORCE !== "1") {
    state.status = "disabled";
    ctx.ui.setStatus("zed-context", "");
    return;
  }
  schedulePoll(0);
}

function stopPolling() {
  pollGeneration++;
  if (timer) clearTimeout(timer);
  timer = undefined;
  inFlight = undefined;
}

function clearSelection() {
  state.selection = undefined;
  state.selectionKey = undefined;
}

function envNumber(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min ? value : fallback;
}

function schedulePoll(delayMs: number) {
  if (timer) clearTimeout(timer);
  const generation = pollGeneration;
  timer = setTimeout(() => void pollOnceAndReschedule(generation), delayMs);
}

async function pollOnceAndReschedule(generation: number) {
  if (!state.enabled || generation !== pollGeneration) return;
  if (!inFlight)
    inFlight = Promise.resolve()
      .then(pollOnce)
      .finally(() => {
        inFlight = undefined;
      });
  await inFlight.catch(() => undefined);
  if (!state.enabled || generation !== pollGeneration) return;
  schedulePoll(state.dbPath ? pollMs() : 5000);
}

async function pollOnce() {
  const dbPath = resolveZedDbPath();
  state.dbPath = dbPath;
  state.lastPollAt = new Date();
  if (!dbPath) {
    clearSelection();
    state.status = "disabled";
    state.lastError = "Zed DB not found";
    updateStatus();
    return;
  }

  const result = resolveZedSelection(dbPath, lastContext?.cwd ?? process.cwd());
  if (result.type === "selection") {
    const nextKey = editorSelectionKey(result.selection);
    state.selection = result.selection;
    state.selectionKey = nextKey;
    state.status = "connected";
    state.lastError = undefined;
  } else if (result.type === "empty") {
    state.selection = undefined;
    state.selectionKey = undefined;
    state.status = "connected";
    state.lastError = undefined;
  } else if (result.type === "workspace_mismatch") {
    clearSelection();
    state.status = "disabled";
    state.lastError = "Zed workspace no longer matches pi cwd";
    stopPolling();
  } else {
    clearSelection();
    state.status = "unavailable";
    state.lastError = result.reason ?? "Zed context unavailable";
    if (debug()) console.error("[zed-context]", state.lastError);
  }
  updateStatus();
}

function isZedTerminal(): boolean {
  return (
    process.env.ZED_TERM === "true" ||
    process.env.TERM_PROGRAM?.toLowerCase() === "zed"
  );
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

function queryJson<T>(dbPath: string, sql: string): T[] {
  const out = execFileSync("sqlite3", ["-readonly", "-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 2000,
  }).trim();
  return out ? (JSON.parse(out) as T[]) : [];
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function resolveZedSelection(dbPath: string, cwd: string): ZedSelectionResult {
  try {
    const rows = queryJson<ActiveRow>(
      dbPath,
      `select i.kind as item_kind, e.item_id as editor_id, i.workspace_id as workspace_id, w.paths as workspace_paths, w.timestamp as timestamp, e.buffer_path as buffer_path, p.active as pane_active
from items i
join panes p on p.pane_id = i.pane_id and p.workspace_id = i.workspace_id
join workspaces w on w.workspace_id = i.workspace_id
left join editors e on e.item_id = i.item_id and e.workspace_id = i.workspace_id
where i.active = 1 and p.active = 1
order by w.timestamp desc`,
    );
    if (rows[0] && scoreWorkspace(rows[0], cwd) < 0)
      return { type: "workspace_mismatch" };

    const matchingRows = rows
      .map((r) => ({ row: r, score: scoreWorkspace(r, cwd) }))
      .filter((x) => x.score >= 0);

    if (rows.length > 0 && matchingRows.length === 0)
      return { type: "workspace_mismatch" };

    const row = matchingRows.sort(compareEditorRows)[0]?.row;
    if (!row) return { type: "empty" };
    if (row.item_kind !== "Editor" || row.editor_id == null || !row.buffer_path)
      return { type: "unavailable", reason: "Active Zed item is not an editor" };

    const selectionRows = queryJson<{
      selection_start: number | null;
      selection_end: number | null;
    }>(
      dbPath,
      `select start as selection_start, end as selection_end from editor_selections where editor_id = ${sqlString(String(row.editor_id))} and workspace_id = ${sqlString(String(row.workspace_id))}`,
    );
    if (
      selectionRows.some(
        (r) => r.selection_start == null || r.selection_end == null,
      )
    )
      return { type: "unavailable", reason: "No persisted Zed selection" };

    let contents: string | undefined;
    try {
      contents = getContents(dbPath, row);
    } catch {
      contents = undefined;
    }
    const ranges = selectionRows.length
      ? selectionRows
          .map((r) => ({
            start: Math.min(r.selection_start!, r.selection_end!),
            end: Math.max(r.selection_start!, r.selection_end!),
          }))
          .sort((a, b) => a.start - b.start || a.end - b.end)
          .map((r) =>
            contents == null
              ? emptyRange()
              : offsetsToSelection(contents, r.start, r.end),
          )
      : [emptyRange()];

    return {
      type: "selection",
      selection: { filePath: row.buffer_path, source: "zed", ranges },
    };
  } catch (error) {
    return {
      type: "unavailable",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function compareEditorRows(
  a: { row: ActiveRow; score: number },
  b: { row: ActiveRow; score: number },
) {
  return (
    b.score - a.score ||
    timestampValue(b.row.timestamp) - timestampValue(a.row.timestamp) ||
    Number(b.row.editor_id ?? 0) - Number(a.row.editor_id ?? 0)
  );
}

function timestampValue(value: number | string | null): number {
  if (value == null) return 0;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
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

function scoreWorkspace(row: ActiveRow, cwd: string): number {
  const resolvedCwd = path.resolve(cwd);
  let best = -1;
  for (const p of workspacePaths(row.workspace_paths)) {
    const ws = path.resolve(p);
    const rel = path.relative(ws, resolvedCwd);
    if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel)))
      best = Math.max(best, ws.length);
  }
  return best;
}

function getContents(dbPath: string, row: ActiveRow): string | undefined {
  const editor = queryJson<{ contents?: string | null }>(
    dbPath,
    `select contents from editors where item_id = ${sqlString(String(row.editor_id))} and workspace_id = ${sqlString(String(row.workspace_id))}`,
  ).at(0);
  if (editor?.contents != null) return String(editor.contents);
  if (!row.buffer_path) return undefined;
  return readCached(row.buffer_path);
}

function readCached(filePath: string): string | undefined {
  const stat = fs.statSync(filePath);
  if (stat.size > maxFileBytes()) return undefined;
  const old = fileCache.get(filePath);
  if (old && old.mtimeMs === stat.mtimeMs && old.size === stat.size)
    return old.text;
  const text = fs.readFileSync(filePath, "utf8");
  fileCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, text });
  while (fileCache.size > 4) fileCache.delete(fileCache.keys().next().value!);
  return text;
}

function utf8ByteOffsetToStringIndex(text: string, byteOffset: number): number {
  if (byteOffset <= 0) return 0;
  let bytes = 0;
  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) return text.length;
    const next = index + (codePoint > 0xffff ? 2 : 1);
    bytes += encoder.encode(text.slice(index, next)).length;
    if (bytes >= byteOffset) return next;
    index = next;
  }
  return text.length;
}

function offsetsToSelection(
  text: string,
  rawStart: number,
  rawEnd: number,
): EditorSelectionRange {
  const start = utf8ByteOffsetToStringIndex(
    text,
    Math.max(0, Math.min(rawStart, rawEnd)),
  );
  const end = utf8ByteOffsetToStringIndex(
    text,
    Math.max(0, Math.max(rawStart, rawEnd)),
  );
  return {
    text: text.slice(start, end),
    selection: { start: positionAt(text, start), end: positionAt(text, end) },
  };
}

function positionAt(text: string, index: number): Position {
  let line = 1;
  let character = 1;
  for (let i = 0; i < index && i < text.length; ) {
    const cp = text.codePointAt(i);
    const next = i + ((cp ?? 0) > 0xffff ? 2 : 1);
    if (text[i] === "\n") {
      line++;
      character = 1;
    } else character++;
    i = next;
  }
  return { line, character };
}

function emptyRange(): EditorSelectionRange {
  // Sentinel for “file is open, but Zed has not persisted a cursor/selection for
  // this editor yet”. Do not present this as #1; that would falsely imply the
  // cursor is on the first line after sidebar preview/open.
  return {
    text: "",
    selection: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    },
  };
}

function editorSelectionKey(selection: EditorSelection): string {
  return JSON.stringify({
    filePath: selection.filePath,
    ranges: selection.ranges.map((range) => ({
      start: range.selection.start,
      end: range.selection.end,
      text: range.text,
    })),
  });
}

function getRangeLabel(range: EditorSelectionRange): string | undefined {
  const { start, end } = range.selection;
  if (start.line <= 0 || end.line <= 0) return undefined;
  return start.line === end.line
    ? `#${start.line}`
    : `#${start.line}-${end.line}`;
}

function formatFileLabel(selection: EditorSelection): string {
  const label = selection.ranges.map(getRangeLabel).find(Boolean) ?? "";
  return `${path.basename(selection.filePath)}${label}`;
}

function formatEditorContext(selection: EditorSelection): string {
  const nonEmpty = selection.ranges.filter((range) => range.text.length > 0);
  if (nonEmpty.length === 0) {
    const label = selection.ranges.map(getRangeLabel).find(Boolean);
    return `<system-reminder>Note: The user opened ${label ? `${label} in ` : ""}the file "${selection.filePath}". This may or may not be relevant to the current task.</system-reminder>`;
  }
  const parts = nonEmpty.map((range, index) => {
    const prefix = nonEmpty.length > 1 ? `Selection ${index + 1}: ` : "";
    const label = getRangeLabel(range) ?? "";
    return `Note: The user selected ${prefix}${label} from "${selection.filePath}". \`\`\`${truncate(range.text)}\`\`\`\n\nThis may or may not be relevant to the current task.`;
  });
  return `<system-reminder>${parts.join("\n\n")}</system-reminder>`;
}

function truncate(text: string): string {
  const max = maxSelectionChars();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[Selection truncated: ${text.length} characters total]`;
}

function updateStatus() {
  const ctx = lastContext;
  if (!ctx) return;
  if (!state.enabled) return ctx.ui.setStatus("zed-context", "");
  if (!state.selection) return ctx.ui.setStatus("zed-context", "");
  if (state.selectionKey === state.sentSelectionKey)
    return ctx.ui.setStatus("zed-context", "");

  const hasSelection = state.selection.ranges.some((range) => range.text.length > 0);
  ctx.ui.setStatus(
    "zed-context",
    `${hasSelection ? "✎" : "⌖"} ${formatFileLabel(state.selection)}`,
  );
}

function statusText(ctx: ExtensionContext): string {
  const pending =
    state.selectionKey && state.selectionKey !== state.sentSelectionKey
      ? "pending"
      : "sent/clear";
  return [
    `Zed context: ${state.enabled ? "enabled" : "disabled"}`,
    `Zed terminal: ${isZedTerminal() ? "yes" : "no"}`,
    `DB: ${state.dbPath ?? "not found"}`,
    `Last poll: ${state.lastPollAt?.toLocaleTimeString() ?? "never"}`,
    `Active: ${state.selection ? formatFileLabel(state.selection) : "none"}`,
    `State: ${state.status}${state.selection ? ` (${pending})` : ""}`,
    state.lastError ? `Last error: ${state.lastError}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}
