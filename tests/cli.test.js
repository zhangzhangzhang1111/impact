import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

test("cli prints help without requiring a project path", async () => {
  const result = await runNode(["src/cli.js", "--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage: impact-mcp/);
  assert.equal(result.stderr, "");
});

test("cli prints install config snippets", async () => {
  const result = await runNode(["src/cli.js", "install", "--print-config", "codex"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /\[mcp_servers\.impact\]/);
  assert.match(result.stdout, /github:zhangzhangzhang1111\/impact/);
  assert.equal(result.stderr, "");
});

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd() });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
