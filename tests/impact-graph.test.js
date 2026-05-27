import test from "node:test";
import assert from "node:assert/strict";
import { collectImpactFunctions } from "../src/impact-graph.js";

test("collectImpactFunctions returns changed symbols and two caller layers without duplicates", () => {
  const result = collectImpactFunctions(
    [{ filePath: "src/auth.lua", symbol: "auth.login", language: "lua" }],
    new Map([
      ["auth.login", ["controller.signIn", "job.recheck"]],
      ["controller.signIn", ["router.dispatch"]],
      ["job.recheck", ["scheduler.tick"]],
      ["router.dispatch", ["main"]]
    ])
  );

  assert.deepEqual(result, [
    { symbol: "auth.login", filePath: "src/auth.lua", language: "lua", depth: 0, reason: "changed" },
    { symbol: "controller.signIn", depth: 1, reason: "caller of auth.login" },
    { symbol: "job.recheck", depth: 1, reason: "caller of auth.login" },
    { symbol: "router.dispatch", depth: 2, reason: "caller of controller.signIn" },
    { symbol: "scheduler.tick", depth: 2, reason: "caller of job.recheck" }
  ]);
});
