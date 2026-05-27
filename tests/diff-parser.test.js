import test from "node:test";
import assert from "node:assert/strict";
import { parseChangedFunctionsFromDiff } from "../src/diff-parser.js";

test("parseChangedFunctionsFromDiff extracts changed function symbols from unified diff hunk headers", () => {
  const diff = [
    "diff --git a/src/foo.lua b/src/foo.lua",
    "--- a/src/foo.lua",
    "+++ b/src/foo.lua",
    "@@ -10,6 +10,8 @@ function M.login(user)",
    "+  audit(user)",
    "diff --git a/src/bar.cpp b/src/bar.cpp",
    "--- a/src/bar.cpp",
    "+++ b/src/bar.cpp",
    "@@ -42,7 +42,9 @@ bool AuthService::check(const User& user) {",
    "+  return acl.check(user);"
  ].join("\n");

  assert.deepEqual(parseChangedFunctionsFromDiff(diff), [
    { filePath: "src/foo.lua", symbol: "M.login", language: "lua" },
    { filePath: "src/bar.cpp", symbol: "AuthService::check", language: "cpp" }
  ]);
});

test("parseChangedFunctionsFromDiff deduplicates symbols and ignores non-function hunks", () => {
  const diff = [
    "diff --git a/include/foo.h b/include/foo.h",
    "--- a/include/foo.h",
    "+++ b/include/foo.h",
    "@@ -1,4 +1,5 @@",
    "+#pragma once",
    "@@ -9,4 +10,5 @@ void start_server(int port)",
    "+init_metrics();",
    "@@ -9,4 +10,5 @@ void start_server(int port)",
    "+init_logging();"
  ].join("\n");

  assert.deepEqual(parseChangedFunctionsFromDiff(diff), [
    { filePath: "include/foo.h", symbol: "start_server", language: "cpp" }
  ]);
});
