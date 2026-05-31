import fs from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface SkillHit {
  name: string;
  path: string;
}

interface SessionMessageEntryLike {
  type: "message";
  message?: {
    role?: string;
    content?: unknown;
  };
}

interface ToolCallBlockLike {
  type?: string;
  name?: string;
  arguments?: {
    path?: unknown;
  };
}

export default function skillsUsedExtension(pi: ExtensionAPI) {
  pi.registerCommand("skills-used", {
    description:
      "List skills used in the current session based on SKILL.md reads",
    handler: async (_args, ctx) => {
      const hits = findSkillReads(ctx.sessionManager.getEntries());
      const repoRoot = findGitRoot(ctx.cwd);

      if (hits.length === 0) {
        ctx.ui.notify("No skills used in this session.", "info");
        return;
      }

      ctx.ui.notify(formatHits(hits, repoRoot), "info");
    },
  });
}

function findSkillReads(entries: readonly unknown[]): SkillHit[] {
  const byPath = new Map<string, SkillHit>();

  for (const entry of entries) {
    if (!isSessionMessageEntry(entry)) continue;
    if (entry.message?.role !== "assistant") continue;
    if (!Array.isArray(entry.message.content)) continue;

    for (const block of entry.message.content) {
      if (!isToolCallBlock(block)) continue;
      if (block.name !== "read") continue;

      const skillPath = block.arguments?.path;
      if (typeof skillPath !== "string") continue;
      if (!isSkillMdPath(skillPath)) continue;

      const normalized = path.normalize(skillPath);
      if (!byPath.has(normalized)) {
        byPath.set(normalized, {
          name: skillNameFromPath(normalized),
          path: normalized,
        });
      }
    }
  }

  return [...byPath.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isSessionMessageEntry(
  value: unknown,
): value is SessionMessageEntryLike {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "message"
  );
}

function isToolCallBlock(value: unknown): value is ToolCallBlockLike {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "toolCall"
  );
}

function isSkillMdPath(filePath: string): boolean {
  return /(^|[/\\])skill\.md$/i.test(filePath);
}

function skillNameFromPath(skillPath: string): string {
  return path.basename(path.dirname(skillPath));
}

function findGitRoot(startDirectory: string): string | undefined {
  let directory = path.resolve(startDirectory);

  while (true) {
    if (fs.existsSync(path.join(directory, ".git"))) return directory;

    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function isInRepo(skillPath: string, repoRoot: string | undefined): boolean {
  if (!repoRoot) return false;
  if (!path.isAbsolute(skillPath)) return true;

  const relativePath = path.relative(repoRoot, skillPath);
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

function formatSkillLine(hit: SkillHit, repoRoot: string | undefined): string {
  if (isInRepo(hit.path, repoRoot)) return `- ${hit.name}`;
  return `- ${hit.name} (${hit.path})`;
}

function formatHits(
  hits: readonly SkillHit[],
  repoRoot: string | undefined,
): string {
  return [
    "Skills used in this session:",
    "",
    ...hits.map((hit) => formatSkillLine(hit, repoRoot)),
  ]
    .join("\n")
    .trimEnd();
}
