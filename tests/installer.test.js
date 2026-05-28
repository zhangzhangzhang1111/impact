import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildServerConfig,
  buildSkillInstallInstruction,
  getSkillTarget,
  getTarget,
  installSkillTarget,
  mergeJsonMcpConfig,
  upsertCodexToml
} from "../src/installer.js";

test("buildServerConfig uses GitHub npx command by default", () => {
  assert.deepEqual(buildServerConfig(), {
    command: "npx",
    args: ["github:zhangzhangzhang1111/impact", "--mcp"],
    env: {
      IMPACT_LUALS_MCP_COMMAND: "npx",
      IMPACT_LUALS_MCP_ARGS: "github:zhangzhangzhang1111/lua-language-server luals-mcp"
    }
  });
});

test("buildServerConfig can set a default report output directory", () => {
  assert.deepEqual(buildServerConfig({ outputDir: "D:/impact-reports" }), {
    command: "npx",
    args: ["github:zhangzhangzhang1111/impact", "--mcp"],
    env: {
      IMPACT_LUALS_MCP_COMMAND: "npx",
      IMPACT_LUALS_MCP_ARGS: "github:zhangzhangzhang1111/lua-language-server luals-mcp",
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

test("buildSkillInstallInstruction mentions skill path and MCP tool", () => {
  const instruction = buildSkillInstallInstruction(getSkillTarget("codex"), {
    skillDir: "/tmp/code-impact-review"
  });

  assert.match(instruction, /\/tmp\/code-impact-review\/SKILL\.md/);
  assert.match(instruction, /npx github:zhangzhangzhang1111\/impact --mcp/);
  assert.match(instruction, /npx github:zhangzhangzhang1111\/lua-language-server luals-mcp/);
  assert.match(instruction, /analyze_code_impact/);
});

test("installSkillTarget copies skill directories and writes instruction targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "impact-skill-install-"));
  const skillDir = join(root, "source-skill");
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: code-impact-review\ndescription: test\n---\n");

  const codexTarget = { id: "codex", name: "Codex", type: "skill-dir", path: () => join(root, "codex-skill") };
  const geminiTarget = { id: "gemini", name: "Gemini CLI", type: "instruction-file", path: () => join(root, "GEMINI.md") };
  const cursorTarget = { id: "cursor", name: "Cursor", type: "cursor-rule", path: () => join(root, "rules", "code-impact-review.mdc") };

  installSkillTarget(codexTarget, { skillDir });
  installSkillTarget(geminiTarget, { skillDir });
  installSkillTarget(cursorTarget, { skillDir });
  installSkillTarget(geminiTarget, { skillDir });

  assert.equal(existsSync(join(root, "codex-skill", "SKILL.md")), true);
  const gemini = await readFile(join(root, "GEMINI.md"), "utf8");
  const cursor = await readFile(join(root, "rules", "code-impact-review.mdc"), "utf8");

  assert.equal((gemini.match(/impact:code-impact-review:start/g) ?? []).length, 1);
  assert.match(gemini, /Primary MCP tool/);
  assert.match(cursor, /alwaysApply: false/);
  assert.match(cursor, /analyze_code_impact/);
});
