import { runCommand } from "./process.js";

export async function initializeCodeGraph(projectPath) {
  await runCommand("codegraph", ["init", "-i", projectPath], { cwd: projectPath });
}

export async function getTwoLayerCallerMap(projectPath, changedFunctions, options = {}) {
  const limit = String(options.limit ?? 30);
  const callerMap = new Map();
  const queue = changedFunctions.map((item) => ({ symbol: item.symbol, depth: 0 }));
  const visited = new Set();

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.depth >= 2 || visited.has(current.symbol)) {
      continue;
    }
    visited.add(current.symbol);
    const callers = await getCallers(projectPath, current.symbol, limit);
    callerMap.set(current.symbol, callers);
    for (const caller of callers) {
      queue.push({ symbol: caller.symbol, depth: current.depth + 1 });
    }
  }

  return callerMap;
}

export async function getCallers(projectPath, symbol, limit) {
  try {
    const { stdout } = await runCommand("codegraph", ["callers", symbol, "-p", projectPath, "-l", limit, "-j"], { cwd: projectPath });
    return parseCodeGraphJson(stdout);
  } catch (error) {
    return fallbackCallers(projectPath, symbol, error);
  }
}

export function parseCodeGraphJson(stdout) {
  const parsed = JSON.parse(extractJson(stdout));
  const items = Array.isArray(parsed) ? parsed : parsed.callers ?? parsed.results ?? [];
  return items.map((item) => ({
    symbol: item.symbol ?? item.name ?? item.caller ?? item.id,
    filePath: item.filePath ?? item.file ?? item.path,
    language: item.language
  })).filter((item) => item.symbol);
}

function extractJson(stdout) {
  const clean = stripAnsi(stdout || "").trim();
  if (!clean) {
    return "[]";
  }
  for (let index = 0; index < clean.length; index += 1) {
    if (clean[index] !== "[" && clean[index] !== "{") {
      continue;
    }
    const candidate = clean.slice(index);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Keep scanning: CodeGraph may print log lines like "[i]" before JSON.
    }
  }
  return "[]";
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

async function fallbackCallers(projectPath, symbol, originalError) {
  const needle = symbol.split(/[.:]/).pop();
  if (!needle) {
    throw originalError;
  }
  try {
    const { stdout } = await runCommand("rg", ["--line-number", "--fixed-strings", needle, "."], { cwd: projectPath });
    return stdout.split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 20)
      .map((line) => {
        const [filePath, lineNumber] = line.split(":");
        return { symbol: `${filePath}:${lineNumber}`, filePath, language: "unknown" };
      });
  } catch {
    throw originalError;
  }
}
