import test from "node:test";
import assert from "node:assert/strict";
import { renderHtmlReport, renderMarkdownReport } from "../src/report.js";

const sample = {
  title: "Impact Analysis",
  repository: "demo",
  baseRef: "origin/master",
  headRef: "feature/login",
  generatedAt: "2026-05-28T02:30:00.000Z",
  diffText: "diff --git a/src/auth.lua b/src/auth.lua\n+function auth.login() end",
  changedFunctions: [{ filePath: "src/auth.lua", symbol: "auth.login", language: "lua" }],
  impactFunctions: [
    { symbol: "auth.login", filePath: "src/auth.lua", language: "lua", depth: 0, reason: "changed" },
    { symbol: "controller.signIn", depth: 1, reason: "caller of auth.login" }
  ],
  aiAnalysis: {
    impactSummary: "Login behavior may affect sign-in routing.",
    testSuggestions: ["Cover successful login", "Cover failed permission check"],
    reviewFindings: ["Check Lua nil handling", "Check C/C++ ownership boundaries"]
  }
};

test("renderMarkdownReport renders impact, tests, and review sections", () => {
  const markdown = renderMarkdownReport(sample);

  assert.match(markdown, /# Impact Analysis/);
  assert.match(markdown, /## Overview/);
  assert.match(markdown, /## Business Function Impact Analysis/);
  assert.match(markdown, /## Business Function Test Checklist/);
  assert.match(markdown, /## Code Review/);
  assert.match(markdown, /## Git Diff/);
  assert.match(markdown, /auth\.login/);
  assert.match(markdown, /Cover successful login/);
  assert.match(markdown, /Check Lua nil handling/);
  assert.match(markdown, /diff --git a\/src\/auth\.lua b\/src\/auth\.lua/);
  assert.match(markdown, /\| High \| auth\.login \| Verify changed function behavior/);
  assert.match(markdown, /\| Medium \| controller\.signIn \| Verify direct caller workflow/);
});

test("renderHtmlReport renders standalone html with escaped dynamic content", () => {
  const html = renderHtmlReport({
    ...sample,
    aiAnalysis: { ...sample.aiAnalysis, impactSummary: "<script>alert(1)</script>" }
  });

  assert.match(html, /<!doctype html>/);
  assert.match(html, /业务功能测试清单/);
  assert.match(html, /risk-high/);
  assert.match(html, /risk-medium/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test("buildReportFileNames uses project, branch, and timestamp naming", async () => {
  const { buildReportFileNames } = await import("../src/report.js");

  assert.deepEqual(buildReportFileNames("demo/app", "feature/login", "2026-05-28T02:30:40.123Z"), {
    markdownFileName: "demo_app_feature_login_20260528_023040.md",
    htmlFileName: "demo_app_feature_login_20260528_023040.html"
  });
});
