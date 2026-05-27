export function collectImpactFunctions(changedFunctions, callerMap, maxDepth = 2) {
  const results = [];
  const seen = new Set();
  const queue = [];

  for (const changed of changedFunctions) {
    addResult({
      symbol: changed.symbol,
      filePath: changed.filePath,
      language: changed.language,
      depth: 0,
      reason: "changed"
    });
    queue.push({ symbol: changed.symbol, depth: 0 });
  }

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.depth >= maxDepth) {
      continue;
    }

    const callers = callerMap.get(current.symbol) ?? [];
    for (const caller of callers) {
      const symbol = typeof caller === "string" ? caller : caller.symbol;
      if (!symbol || seen.has(symbol)) {
        continue;
      }
      const depth = current.depth + 1;
      addResult({
        ...(typeof caller === "string" ? {} : caller),
        symbol,
        depth,
        reason: `caller of ${current.symbol}`
      });
      queue.push({ symbol, depth });
    }
  }

  return results;

  function addResult(result) {
    if (seen.has(result.symbol)) {
      return;
    }
    seen.add(result.symbol);
    results.push(result);
  }
}
