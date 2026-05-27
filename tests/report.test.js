import test from "node:test";
import assert from "node:assert/strict";
import { renderHtmlReport, renderMarkdownReport } from "../src/report.js";

const sample = {
  title: "Impact Analysis",
  repository: "demo",
  baseRef: "origin/master",
  headRef: "HEAD",
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
  assert.match(markdown, /auth\.login/);
  assert.match(markdown, /Cover successful login/);
  assert.match(markdown, /Check Lua nil handling/);
});

test("renderHtmlReport renders standalone html with escaped dynamic content", () => {
  const html = renderHtmlReport({
    ...sample,
    aiAnalysis: { ...sample.aiAnalysis, impactSummary: "<script>alert(1)</script>" }
  });

  assert.match(html, /<!doctype html>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});
