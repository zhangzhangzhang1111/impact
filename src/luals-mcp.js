import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function getLuaMcpCallers(projectPath, symbol, options = {}) {
  const command = options.command;
  const args = options.args ?? [];
  if (!command) {
    throw new Error("LuaLS MCP command is not configured.");
  }

  const client = new LuaLsMcpClient(command, args, { cwd: projectPath, timeoutMs: options.timeoutMs });
  try {
    await client.start();
    await client.callTool("luals_initialize", {
      rootUri: pathToFileURL(resolve(projectPath)).href,
      workspaceFolders: [{ uri: pathToFileURL(resolve(projectPath)).href, name: projectPath.split(/[\\/]/).pop() || "workspace" }],
      timeoutMs: options.timeoutMs
    });

    const location = await findLuaSymbolLocation(projectPath, symbol, options.changedFunctions ?? []);
    if (!location) {
      throw new Error(`Could not locate Lua symbol ${symbol} in changed files.`);
    }

    const text = await readFile(join(projectPath, location.filePath), "utf8");
    const uri = pathToFileURL(join(projectPath, location.filePath)).href;
    await client.callTool("luals_open_document", { uri, text, languageId: "lua", version: 1 });
    const references = await client.callTool("luals_request", {
      method: "textDocument/references",
      params: {
        textDocument: { uri },
        position: { line: location.line, character: location.character },
        context: { includeDeclaration: false }
      },
      timeoutMs: options.timeoutMs
    });
    return normalizeLuaReferences(references, projectPath, symbol);
  } finally {
    await client.stop();
  }
}

export function normalizeLuaReferences(references, projectPath, symbol) {
  const items = Array.isArray(references) ? references : [];
  return items.map((item) => {
    const filePath = uriToRelativePath(item.uri, projectPath);
    const line = Number(item.range?.start?.line ?? 0) + 1;
    return {
      symbol: `${filePath}:${line}`,
      filePath,
      language: "lua",
      provider: "luals-mcp",
      reason: `LuaLS reference of ${symbol}`
    };
  }).filter((item) => item.filePath);
}

export async function findLuaSymbolLocation(projectPath, symbol, changedFunctions) {
  const candidate = changedFunctions.find((item) => item.symbol === symbol && item.language === "lua" && item.filePath);
  if (!candidate) {
    return null;
  }
  const text = await readFile(join(projectPath, candidate.filePath), "utf8");
  const lines = text.split(/\r?\n/);
  const short = lastSegment(symbol);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const character = findCharacter(line, symbol, short);
    if (character !== -1) {
      return { filePath: candidate.filePath, line: lineIndex, character };
    }
  }
  return { filePath: candidate.filePath, line: 0, character: 0 };
}

class LuaLsMcpClient {
  constructor(command, args, options = {}) {
    this.command = command;
    this.args = args;
    this.options = options;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
  }

  start() {
    return new Promise((resolveStart, rejectStart) => {
      this.child = spawn(this.command, this.args, {
        cwd: this.options.cwd,
        shell: process.platform === "win32",
        env: { ...process.env, ...(this.options.env ?? {}) },
        stdio: ["pipe", "pipe", "pipe"]
      });
      let stderr = "";
      const onError = (error) => {
        rejectStart(error);
      };
      this.child.once("error", onError);
      this.child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      this.child.stdout?.on("data", (chunk) => this.onData(chunk));
      this.child.once("spawn", async () => {
        this.child.off("error", onError);
        try {
          await this.request("initialize", {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "impact", version: "0.1.0" }
          });
          this.notify("notifications/initialized", {});
          resolveStart();
        } catch (error) {
          rejectStart(new Error(`${error.message}${stderr ? `\n${stderr}` : ""}`));
        }
      });
      this.child.once("exit", (code) => {
        for (const { reject, timer } of this.pending.values()) {
          clearTimeout(timer);
          reject(new Error(`LuaLS MCP exited with code ${code}${stderr ? `: ${stderr}` : ""}`));
        }
        this.pending.clear();
      });
    });
  }

  async stop() {
    if (!this.child || this.child.exitCode !== null) {
      return;
    }
    try {
      await this.callTool("luals_shutdown", { timeoutMs: this.options.timeoutMs });
    } catch {
      // Shutdown is best-effort; killing below prevents orphaned children.
    }
    this.child.kill();
  }

  async callTool(name, args) {
    const result = await this.request("tools/call", { name, arguments: args });
    const text = result?.content?.[0]?.text;
    return text ? JSON.parse(text) : null;
  }

  request(method, params) {
    const id = this.nextId;
    this.nextId += 1;
    const timeoutMs = this.options.timeoutMs ?? 15_000;
    return new Promise((resolveRequest, rejectRequest) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectRequest(new Error(`LuaLS MCP request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolveRequest, reject: rejectRequest, timer });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method, params) {
    this.write({ jsonrpc: "2.0", method, params });
  }

  write(payload) {
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  onData(chunk) {
    this.buffer += chunk.toString("utf8");
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline === -1) {
        return;
      }
      const raw = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!raw) {
        continue;
      }
      const message = JSON.parse(raw);
      const pending = this.pending.get(message.id);
      if (!pending) {
        continue;
      }
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    }
  }
}

function findCharacter(line, symbol, short) {
  const candidates = [
    symbol,
    short,
    `${short}(`
  ].filter(Boolean);
  for (const candidate of candidates) {
    const index = line.indexOf(candidate);
    if (index !== -1) {
      return index;
    }
  }
  return -1;
}

function lastSegment(symbol) {
  return String(symbol || "").split(/[.:]/).pop() ?? "";
}

function uriToRelativePath(uri, projectPath) {
  if (!uri?.startsWith("file://")) {
    return "";
  }
  const normalizedProject = resolve(projectPath);
  const normalizedFile = resolve(fileURLToPath(uri));
  const relativePath = relative(normalizedProject, normalizedFile);
  const insideProject = relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath);
  const result = insideProject ? relativePath : normalizedFile;
  return sep === "\\" ? result.replace(/\\/g, "/") : result;
}
