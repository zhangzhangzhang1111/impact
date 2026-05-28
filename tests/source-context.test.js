import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildFunctionDiffContexts, collectFunctionContexts } from "../src/source-context.js";

test("collectFunctionContexts returns bounded source snippets for impact functions", async () => {
  const root = await mkdtemp(join(tmpdir(), "impact-context-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "auth.lua"), [
    "local M = {}",
    "function M.login(user)",
    "  return user ~= nil",
    "end",
    "return M"
  ].join("\n"));

  const contexts = await collectFunctionContexts(root, [
    { filePath: "src/auth.lua", symbol: "M.login", language: "lua" }
  ], { radius: 1 });

  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].startLine, 1);
  assert.match(contexts[0].code, /function M\.login/);
});

test("buildFunctionDiffContexts maps changed functions to their diff hunks", () => {
  const diff = [
    "diff --git a/src/auth.lua b/src/auth.lua",
    "--- a/src/auth.lua",
    "+++ b/src/auth.lua",
    "@@ -10 +10 @@ function M.login(user)",
    "-  return true",
    "+  return user ~= nil"
  ].join("\n");

  const contexts = buildFunctionDiffContexts(diff, [
    { filePath: "src/auth.lua", symbol: "M.login", language: "lua" }
  ]);

  assert.equal(contexts.length, 1);
  assert.match(contexts[0].diffSnippet, /return user ~= nil/);
});
