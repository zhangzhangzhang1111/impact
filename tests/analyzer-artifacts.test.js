import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeReportArtifacts } from "../src/analyzer.js";

const report = {
  title: "Impact Analysis",
  repository: "demo",
  baseRef: "origin/master",
  headRef: "feature/login",
  generatedAt: "2026-05-28T02:30:00.000Z",
  diffText: "diff --git a/src/auth.lua b/src/auth.lua\n+function auth.login() end",
  changedFunctions: [{ filePath: "src/auth.lua", symbol: "auth.login", language: "lua" }],
  impactFunctions: [{ symbol: "auth.login", filePath: "src/auth.lua", language: "lua", depth: 0, reason: "changed" }],
  aiAnalysis: {
    impactSummary: "登录行为可能影响登录路由。",
    riskAssessments: [],
    testSuggestions: ["覆盖登录成功场景"],
    reviewFindings: ["检查 Lua nil 处理"]
  }
};

test("writeReportArtifacts writes every report artifact locally and returns absolute paths", async () => {
  const projectPath = await mkdtemp(join(tmpdir(), "impact-artifacts-"));
  const output = await writeReportArtifacts(projectPath, "impact-report", report, {});

  assert.equal(existsSync(output.markdownPath), true);
  assert.equal(existsSync(output.htmlPath), true);
  assert.equal(existsSync(output.jsonPath), true);
  assert.equal(existsSync(output.promptPath), true);
  assert.match(output.markdownPath, /impact-report/);

  const markdown = await readFile(output.markdownPath, "utf8");
  const prompt = await readFile(output.promptPath, "utf8");
  assert.match(markdown, /代码影响面分析报告/);
  assert.match(prompt, /输出中文 Markdown/);
});
