import { runImpactAnalysis } from "./analyzer.js";

export function startMcpServer(input = process.stdin, output = process.stdout) {
  let buffer = Buffer.alloc(0);

  input.on("data", async (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    while (buffer.length) {
      const parsed = parseFrame(buffer);
      if (!parsed) {
        break;
      }
      buffer = parsed.rest;
      await handleMessage(parsed.body, output);
    }
  });
}

async function handleMessage(raw, output) {
  let message;
  try {
    message = JSON.parse(raw);
    const result = await routeMessage(message);
    if (message.id === undefined) {
      return;
    }
    writeJson(output, { jsonrpc: "2.0", id: message.id, result });
  } catch (error) {
    if (message?.id === undefined) {
      return;
    }
    writeJson(output, {
      jsonrpc: "2.0",
      id: message?.id ?? null,
      error: { code: -32000, message: error.message }
    });
  }
}

async function routeMessage(message) {
  if (message.method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "impact-mcp", version: "0.1.0" }
    };
  }
  if (message.method === "tools/list") {
    return { tools: [impactToolDefinition()] };
  }
  if (message.method === "tools/call") {
    if (message.params?.name !== "analyze_code_impact") {
      throw new Error(`Unknown tool: ${message.params?.name}`);
    }
    const analysis = await runImpactAnalysis(message.params.arguments ?? {});
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          summary: analysis.aiAnalysis.impactSummary,
          markdownPath: analysis.output.markdownPath,
          htmlPath: analysis.output.htmlPath,
          changedFunctionCount: analysis.changedFunctions.length,
          impactFunctionCount: analysis.impactFunctions.length
        }, null, 2)
      }]
    };
  }
  return {};
}

function impactToolDefinition() {
  return {
    name: "analyze_code_impact",
    description: "Analyze code impact from git diff, CodeGraph two-layer callers, AI review, and report generation.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Target project path." },
        branch: { type: "string", description: "Head branch/ref. Defaults to HEAD when commits are omitted." },
        beforeCommit: { type: "string", description: "Optional base commit/ref. Defaults to origin/master." },
        afterCommit: { type: "string", description: "Optional head commit/ref. Defaults to branch or HEAD." },
        outputDir: { type: "string", description: "Optional report output directory under project path." },
        config: { type: "string", description: "Optional impact config JSON path." }
      },
      required: ["path"]
    }
  };
}

function writeJson(output, payload) {
  const body = JSON.stringify(payload);
  output.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function parseFrame(buffer) {
  if (buffer[0] === 123) {
    const newline = buffer.indexOf("\n");
    if (newline === -1) {
      return null;
    }
    return {
      body: buffer.subarray(0, newline).toString("utf8"),
      rest: buffer.subarray(newline + 1)
    };
  }

  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    return null;
  }
  const header = buffer.subarray(0, headerEnd).toString("utf8");
  const length = Number(header.match(/Content-Length:\s*(\d+)/i)?.[1]);
  if (!Number.isFinite(length)) {
    throw new Error("Invalid MCP frame: missing Content-Length header.");
  }
  const bodyStart = headerEnd + 4;
  const bodyEnd = bodyStart + length;
  if (buffer.length < bodyEnd) {
    return null;
  }
  return {
    body: buffer.subarray(bodyStart, bodyEnd).toString("utf8"),
    rest: buffer.subarray(bodyEnd)
  };
}
