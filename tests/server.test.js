import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { startMcpServer } from "../src/server.js";

test("startMcpServer responds to MCP content-length initialize frames", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  startMcpServer(input, output);

  const responsePromise = readFrame(output);
  writeFrame(input, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const response = await responsePromise;

  assert.equal(response.id, 1);
  assert.equal(response.result.serverInfo.name, "impact-mcp");
});

function writeFrame(stream, payload) {
  const body = JSON.stringify(payload);
  stream.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function readFrame(stream) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    stream.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }
      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const length = Number(header.match(/Content-Length:\s*(\d+)/i)?.[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) {
        return;
      }
      resolve(JSON.parse(buffer.subarray(bodyStart, bodyStart + length).toString("utf8")));
    });
    stream.on("error", reject);
  });
}
