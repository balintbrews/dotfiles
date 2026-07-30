import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const FAST_SERVICE_TIER = "priority";
// Codex models enabled for the priority service tier in this config.
const FAST_MODE_MODEL_IDS = new Set([
  "gpt-5.6-luna",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
]);

function supportsCodexFastMode(model: Model<Api> | undefined): boolean {
  return (
    model?.provider === "openai-codex" &&
    model.api === "openai-codex-responses" &&
    FAST_MODE_MODEL_IDS.has(model.id)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function codexFastMode(pi: ExtensionAPI) {
  let enabled = true;

  pi.on("before_provider_request", (event, ctx) => {
    if (!supportsCodexFastMode(ctx.model) || !isRecord(event.payload)) return;

    const payload = { ...event.payload };
    if (enabled) payload.service_tier = FAST_SERVICE_TIER;
    else delete payload.service_tier;
    return payload;
  });

  pi.registerCommand("codex-fast", {
    description: "Toggle Codex Fast Mode for supported openai-codex models in this session",
    getArgumentCompletions: (prefix) => {
      const options = ["on", "off", "status"];
      const filtered = options.filter((option) =>
        option.startsWith(prefix.trim().toLowerCase()),
      );
      return filtered.length > 0
        ? filtered.map((option) => ({ value: option, label: option }))
        : null;
    },
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();

      if (action === "on") enabled = true;
      else if (action === "off") enabled = false;
      else if (action !== "" && action !== "status") {
        ctx.ui.notify("Usage: /codex-fast [on|off|status]", "info");
        return;
      }

      const inactiveModel =
        enabled && ctx.model && !supportsCodexFastMode(ctx.model)
          ? ` (inactive for ${ctx.model.provider}/${ctx.model.id})`
          : "";
      ctx.ui.notify(
        `Codex Fast Mode: ${enabled ? "ON" : "OFF"}${inactiveModel}`,
        "info",
      );
    },
  });
}
