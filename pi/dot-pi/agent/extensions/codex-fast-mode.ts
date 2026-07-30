import { streamSimpleOpenAICodexResponses } from "@earendil-works/pi-ai";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SUPPORTED_MODEL_ID = "gpt-5.6-sol";

function isCodexResponsesModel(
  model: Model<Api>,
): model is Model<"openai-codex-responses"> {
  return model.api === "openai-codex-responses";
}

export default function codexFastMode(pi: ExtensionAPI) {
  let enabled = true;
  pi.registerProvider("openai-codex", {
    api: "openai-codex-responses",
    streamSimple(model, context, options) {
      if (!isCodexResponsesModel(model)) {
        throw new Error(`Unsupported Codex API: ${model.api}`);
      }

      const fastModeOptions =
        enabled && model.id === SUPPORTED_MODEL_ID
          ? { serviceTier: "priority" as const }
          : {};

      return streamSimpleOpenAICodexResponses(model, context, {
        ...options,
        ...fastModeOptions,
        textVerbosity: "low",
      });
    },
  });

  pi.registerCommand("codex-fast", {
    description: `Toggle Codex Fast Mode for openai-codex/${SUPPORTED_MODEL_ID} in this session`,
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

      ctx.ui.notify(`Codex Fast Mode: ${enabled ? "ON" : "OFF"}`, "info");
    },
  });
}
