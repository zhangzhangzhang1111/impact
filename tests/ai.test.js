import test from "node:test";
import assert from "node:assert/strict";
import { analyzeWithAi } from "../src/ai.js";

test("analyzeWithAi returns Chinese local analysis when AI is disabled", async () => {
  const analysis = await analyzeWithAi({
    changedFunctions: [{ symbol: "auth.login", filePath: "src/auth.lua", language: "lua" }],
    impactFunctions: [
      { symbol: "auth.login", filePath: "src/auth.lua", language: "lua", depth: 0, reason: "changed" },
      { symbol: "controller.signIn", filePath: "src/controller.lua", language: "lua", depth: 1, reason: "caller" }
    ],
    sourceContexts: [{ symbol: "auth.login", code: "function auth.login() end" }],
    functionDiffs: []
  }, {
    ai: { enabled: false },
    businessNotes: ["登录链路需要回归。"],
    reviewRules: ["Lua: check nil handling."]
  });

  assert.match(analysis.impactSummary, /变更函数/);
  assert.match(analysis.impactSummary, /两层调用链/);
  assert.equal(analysis.riskAssessments[0].risk, "高");
  assert.match(analysis.testSuggestions[0], /单元测试/);
  assert.match(analysis.reviewFindings[0], /Lua/);
  assert.doesNotMatch(analysis.impactSummary, /Changed functions|Potential callers|AI is not configured/);
});
