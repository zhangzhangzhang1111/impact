import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_REVIEW_RULES = [
  "Lua: check nil handling, table mutation side effects, coroutine/yield safety, module global pollution, and error propagation.",
  "C/C++: check ownership, lifetime, null checks, bounds, integer overflow, thread safety, ABI/API compatibility, and error-code handling.",
  "Cross-language changes: check serialization contracts, memory ownership across boundaries, and rollback behavior."
];

export function loadImpactConfig(projectPath, explicitConfigPath) {
  const configPath = explicitConfigPath ?? join(projectPath, "impact.config.json");
  const fileConfig = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
  return {
    remoteMaster: "origin/master",
    outputDir: "impact-report",
    codegraphDepth: 2,
    codegraphLimit: 30,
    ai: {
      enabled: Boolean(process.env.IMPACT_AI_API_KEY),
      endpoint: process.env.IMPACT_AI_ENDPOINT ?? "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.IMPACT_AI_API_KEY,
      model: process.env.IMPACT_AI_MODEL ?? "gpt-4.1-mini",
      maxImpactFunctions: 80,
      maxChangedFunctions: 60
    },
    businessNotes: [],
    reviewRules: DEFAULT_REVIEW_RULES,
    ...fileConfig,
    ai: {
      enabled: Boolean(process.env.IMPACT_AI_API_KEY),
      endpoint: process.env.IMPACT_AI_ENDPOINT ?? "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.IMPACT_AI_API_KEY,
      model: process.env.IMPACT_AI_MODEL ?? "gpt-4.1-mini",
      maxImpactFunctions: 80,
      maxChangedFunctions: 60,
      ...(fileConfig.ai ?? {})
    },
    businessNotes: fileConfig.businessNotes ?? [],
    reviewRules: [...DEFAULT_REVIEW_RULES, ...(fileConfig.reviewRules ?? [])]
  };
}
