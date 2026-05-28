import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { splitDiffByFile } from "./report.js";

export async function collectFunctionContexts(projectPath, functions, options = {}) {
  const radius = options.radius ?? 8;
  const cache = new Map();
  const contexts = [];

  for (const item of functions) {
    if (!item.filePath || cache.get(item.filePath) === null) {
      continue;
    }
    if (!cache.has(item.filePath)) {
      try {
        cache.set(item.filePath, await readFile(join(projectPath, item.filePath), "utf8"));
      } catch {
        cache.set(item.filePath, null);
        continue;
      }
    }

    const content = cache.get(item.filePath);
    if (!content) {
      continue;
    }
    contexts.push(buildFunctionContext(item, content, radius));
  }

  return contexts;
}

export function buildFunctionDiffContexts(diffText, changedFunctions) {
  const changedByFile = new Map();
  for (const item of changedFunctions) {
    const list = changedByFile.get(item.filePath) ?? [];
    list.push(item);
    changedByFile.set(item.filePath, list);
  }

  return splitDiffByFile(diffText).flatMap((file) => {
    const candidates = changedByFile.get(file.filePath) ?? [];
    if (candidates.length === 0) {
      return [];
    }
    return splitDiffIntoHunks(file.diffText).flatMap((hunk) => {
      const matched = candidates.find((item) => hunk.header.includes(item.symbol) || hunk.header.includes(lastSegment(item.symbol)));
      if (!matched) {
        return [];
      }
      return [{
        symbol: matched.symbol,
        filePath: matched.filePath,
        language: matched.language,
        diffSnippet: hunk.lines.join("\n")
      }];
    });
  });
}

function buildFunctionContext(item, content, radius) {
  const lines = content.split(/\r?\n/);
  const index = findSymbolLine(lines, item.symbol);
  const startIndex = Math.max(0, index - radius);
  const endIndex = Math.min(lines.length, index + radius + 1);
  return {
    symbol: item.symbol,
    filePath: item.filePath,
    language: item.language,
    startLine: startIndex + 1,
    endLine: endIndex,
    code: lines.slice(startIndex, endIndex).map((line, offset) => `${startIndex + offset + 1}: ${line}`).join("\n")
  };
}

function findSymbolLine(lines, symbol) {
  const exact = String(symbol || "").trim();
  const short = lastSegment(exact);
  const patterns = [
    exact,
    short ? `${short}(` : "",
    short ? `function ${short}` : ""
  ].filter(Boolean);

  for (const pattern of patterns) {
    const index = lines.findIndex((line) => line.includes(pattern));
    if (index !== -1) {
      return index;
    }
  }
  return 0;
}

function splitDiffIntoHunks(diffText) {
  const hunks = [];
  let current = null;
  for (const line of String(diffText || "").split(/\r?\n/)) {
    if (line.startsWith("@@")) {
      current = { header: line, lines: [line] };
      hunks.push(current);
      continue;
    }
    if (current) {
      current.lines.push(line);
    }
  }
  return hunks;
}

function lastSegment(symbol) {
  return String(symbol || "").split(/[.:]/).pop() ?? "";
}
