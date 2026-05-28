import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { findLuaSymbolLocation, normalizeLuaReferences } from "../src/luals-mcp.js";

test("findLuaSymbolLocation locates Lua changed function position", async () => {
  const root = await mkdtemp(join(tmpdir(), "impact-luals-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "auth.lua"), [
    "local M = {}",
    "function M.login(user)",
    "  return user ~= nil",
    "end"
  ].join("\n"));

  const location = await findLuaSymbolLocation(root, "M.login", [
    { filePath: "src/auth.lua", symbol: "M.login", language: "lua" }
  ]);

  assert.deepEqual(location, { filePath: "src/auth.lua", line: 1, character: 9 });
});

test("normalizeLuaReferences converts LuaLS locations to impact caller hints", () => {
  const root = "/tmp/project";
  const references = [{
    uri: pathToFileURL("/tmp/project/src/controller.lua").href,
    range: { start: { line: 24, character: 8 } }
  }];

  assert.deepEqual(normalizeLuaReferences(references, root, "M.login"), [
    {
      symbol: "src/controller.lua:25",
      filePath: "src/controller.lua",
      language: "lua",
      provider: "luals-mcp",
      reason: "LuaLS reference of M.login"
    }
  ]);
});
