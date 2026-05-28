import test from "node:test";
import assert from "node:assert/strict";
import { buildServerConfig, getTarget, mergeJsonMcpConfig, upsertCodexToml } from "../src/installer.js";

test("buildServerConfig uses GitHub npx command by default", () => {
  assert.deepEqual(buildServerConfig(), {
    command: "npx",
    args: ["github:zhangzhangzhang1111/impact", "--mcp"]
  });
});

test("buildServerConfig can set a default report output directory", () => {
  assert.deepEqual(buildServerConfig({ outputDir: "D:/impact-reports" }), {
    command: "npx",
    args: ["github:zhangzhangzhang1111/impact", "--mcp"],
    env: {
      IMPACT_OUTPUT_DIR: "D:/impact-reports"
    }
  });
});

test("mergeJsonMcpConfig preserves existing MCP servers", () => {
  const merged = mergeJsonMcpConfig(
    { mcpServers: { existing: { command: "node", args: ["server.js"] } } },
    "impact",
    buildServerConfig()
  );

  assert.equal(merged.mcpServers.existing.command, "node");
  assert.equal(merged.mcpServers.impact.command, "npx");
});

test("upsertCodexToml inserts and replaces impact MCP server block", () => {
  const first = upsertCodexToml("", buildServerConfig());
  const second = upsertCodexToml(first, { command: "impact-mcp", args: ["--mcp"] });

  assert.match(second, /\[mcp_servers\.impact\]/);
  assert.match(second, /command = "impact-mcp"/);
  assert.doesNotMatch(second, /github:zhangzhangzhang1111\/impact/);
});

test("getTarget exposes supported AI tool install targets", () => {
  assert.equal(getTarget("codex").name, "Codex");
  assert.equal(getTarget("claude").name, "Claude Desktop");
  assert.equal(getTarget("gemini").name, "Gemini CLI");
});
