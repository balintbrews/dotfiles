/**
 * @file Registers private LiteLLM-backed Claude models for Pi.
 *
 * Reads the LiteLLM base URL from private auth.json metadata so the provider
 * definition can live in public dotfiles without exposing internal endpoints.
 *
 * Add the private base URL to ~/.pi/agent/auth.json alongside the LiteLLM key:
 *
 * ```json
 * {
 *   "litellm": {
 *     "type": "apiKey",
 *     "key": "...",
 *     "baseUrl": "https://your-litellm-gateway.example.com"
 *   }
 * }
 * ```
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CLAUDE_MODEL_DEFAULTS = {
  reasoning: true,
  input: ["text", "image"],
  contextWindow: 1000000,
  compat: {
    // https://pi.dev/docs/latest/models#anthropic-messages-compatibility
    // https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking
    forceAdaptiveThinking: true,
  },
};

export default function liteLlmProvider(pi: ExtensionAPI) {
  const baseUrl = getLiteLlmBaseUrl();
  if (!baseUrl) return;

  pi.registerProvider("litellm", {
    baseUrl,
    api: "anthropic-messages",
    apiKey: "$LITELLM_API_KEY",
    models: [
      {
        ...CLAUDE_MODEL_DEFAULTS,
        id: "anthropic.claude-opus-5",
        name: "Claude Opus 5",
        thinkingLevelMap: {
          minimal: null,
          xhigh: "xhigh",
          max: "max",
        },
        cost: {
          input: 5.5,
          output: 27.5,
          cacheRead: 0.55,
          cacheWrite: 6.875,
        },
        maxTokens: 128000,
      },
      {
        ...CLAUDE_MODEL_DEFAULTS,
        id: "anthropic.claude-sonnet-5",
        name: "Claude Sonnet 5",
        thinkingLevelMap: {
          minimal: null,
          xhigh: "xhigh",
        },
        cost: {
          input: 2.2,
          output: 11,
          cacheRead: 0.22,
          cacheWrite: 2.75,
        },
        maxTokens: 128000,
      },
    ],
  });
}

function getLiteLlmBaseUrl(): string | undefined {
  const authPath = path.join(
    process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), ".pi", "agent"),
    "auth.json",
  );

  let baseUrl: unknown;
  try {
    baseUrl = (
      JSON.parse(fs.readFileSync(authPath, "utf8")) as {
        litellm?: {
          baseUrl?: string;
        };
      }
    ).litellm?.baseUrl;
  } catch {
    return undefined;
  }

  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    return undefined;
  }

  return baseUrl.trim();
}
