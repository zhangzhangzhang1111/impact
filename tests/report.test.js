import test from "node:test";
import assert from "node:assert/strict";
import { renderAiPrompt, renderHtmlReport, renderJsonArtifact, renderMarkdownReport } from "../src/report.js";

const sample = {
  title: "Impact Analysis",
  repository: "demo",
  baseRef: "origin/master",
  headRef: "feature/login",
  generatedAt: "2026-05-28T02:30:00.000Z",
  diffText: [
    "diff --git a/src/auth.lua b/src/auth.lua",
    "+function auth.login() end",
    "diff --git a/src/user.lua b/src/user.lua",
    "-return old_user()",
    "+return new_user()"
  ].join("\n"),
  changedFunctions: [{ filePath: "src/auth.lua", symbol: "auth.login", language: "lua" }],
  impactFunctions: [
    { symbol: "auth.login", filePath: "src/auth.lua", language: "lua", depth: 0, reason: "changed" },
    { symbol: "controller.signIn", depth: 1, reason: "caller of auth.login" }
  ],
  aiAnalysis: {
    impactSummary: "Login behavior may affect sign-in routing.",
    riskAssessments: [
      { risk: "高", symbol: "auth.login", reason: "Auth behavior changed", evidence: "changed" }
    ],
    testSuggestions: ["Cover successful login", "Cover failed permission check"],
    reviewFindings: ["Check Lua nil handling", "Check C/C++ ownership boundaries"]
  }
};

test("renderMarkdownReport renders Chinese impact, tests, review, and per-file diff sections", () => {
  const markdown = renderMarkdownReport(sample);

  assert.match(markdown, /# 代码影响面分析报告/);
  assert.match(markdown, /## 总览/);
  assert.match(markdown, /## 业务功能影响面分析/);
  assert.match(markdown, /## 影响面分析结果（风险等级划分）/);
  assert.match(markdown, /## 业务功能测试清单/);
  assert.match(markdown, /## 代码评审/);
  assert.match(markdown, /## Git Diff（按文件）/);
  assert.match(markdown, /auth\.login/);
  assert.match(markdown, /Cover successful login/);
  assert.match(markdown, /Check Lua nil handling/);
  assert.match(markdown, /diff --git a\/src\/auth\.lua b\/src\/auth\.lua/);
  assert.match(markdown, /\| 高 \| auth\.login \| 验证变更函数行为/);
  assert.match(markdown, /\| 中 \| controller\.signIn \| 验证直接调用方业务流程/);
  assert.match(markdown, /<details><summary>src\/auth\.lua<\/summary>/);
  assert.match(markdown, /<details><summary>src\/user\.lua<\/summary>/);
});

test("renderHtmlReport renders Chinese standalone html with escaped dynamic content and collapsed per-file diff", () => {
  const html = renderHtmlReport({
    ...sample,
    aiAnalysis: { ...sample.aiAnalysis, impactSummary: "<script>alert(1)</script>" }
  });

  assert.match(html, /<!doctype html>/);
  assert.match(html, /代码影响面分析报告/);
  assert.match(html, /影响面分析结果（风险等级划分）/);
  assert.match(html, /业务功能测试清单/);
  assert.match(html, /<details class="diff-file">/);
  assert.match(html, /<summary>src\/auth\.lua<\/summary>/);
  assert.doesNotMatch(html, /<details class="diff-file" open>/);
  assert.match(html, /src\/auth\.lua/);
  assert.match(html, /src\/user\.lua/);
  assert.match(html, /risk-high/);
  assert.match(html, /risk-medium/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test("splitDiffByFile returns one diff block per file", async () => {
  const { splitDiffByFile } = await import("../src/report.js");

  assert.deepEqual(splitDiffByFile(sample.diffText).map((item) => item.filePath), [
    "src/auth.lua",
    "src/user.lua"
  ]);
});

test("buildReportFileNames uses project, branch, and timestamp naming", async () => {
  const { buildReportFileNames } = await import("../src/report.js");

  assert.deepEqual(buildReportFileNames("demo/app", "feature/login", "2026-05-28T02:30:40.123Z"), {
    markdownFileName: "demo_app_feature_login_20260528_023040.md",
    htmlFileName: "demo_app_feature_login_20260528_023040.html",
    jsonFileName: "demo_app_feature_login_20260528_023040.json",
    promptFileName: "demo_app_feature_login_20260528_023040.prompt.md"
  });
});

test("renderJsonArtifact and renderAiPrompt expose AI-ready context", () => {
  const json = JSON.parse(renderJsonArtifact({
    ...sample,
    functionDiffs: [{ symbol: "auth.login", diffSnippet: "+audit(user)" }],
    sourceContexts: [{ symbol: "auth.login", code: "1: function auth.login() end" }]
  }));
  const prompt = renderAiPrompt(sample, { reviewRules: ["Lua: check nil handling."] });

  assert.equal(json.meta.repository, "demo");
  assert.equal(json.review.riskAssessments[0].symbol, "auth.login");
  assert.equal(json.changes.functionDiffs[0].symbol, "auth.login");
  assert.match(prompt, /AI 影响面分析 Prompt/);
  assert.match(prompt, /Lua: check nil handling/);
});
