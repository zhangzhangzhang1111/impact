import test from "node:test";
import assert from "node:assert/strict";
import { parseCodeGraphJson } from "../src/codegraph.js";

test("parseCodeGraphJson ignores ANSI log lines before JSON output", () => {
  const output = "\u001b[34m[i]\u001b[39m syncing index\n[{\"symbol\":\"foo.bar\",\"filePath\":\"src/foo.lua\"}]";

  assert.deepEqual(parseCodeGraphJson(output), [
    { symbol: "foo.bar", filePath: "src/foo.lua", language: undefined }
  ]);
});
