const LANGUAGE_BY_EXTENSION = new Map([
  [".lua", "lua"],
  [".c", "c"],
  [".h", "cpp"],
  [".cc", "cpp"],
  [".cpp", "cpp"],
  [".cxx", "cpp"],
  [".hpp", "cpp"],
  [".hh", "cpp"],
  [".js", "javascript"],
  [".jsx", "javascript"],
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".go", "go"],
  [".rs", "rust"],
  [".java", "java"],
  [".kt", "kotlin"],
  [".py", "python"],
  [".rb", "ruby"],
  [".php", "php"],
  [".cs", "csharp"]
]);

export function parseChangedFunctionsFromDiff(diffText) {
  const changed = [];
  const seen = new Set();
  let currentFile = "";

  for (const line of diffText.split(/\r?\n/)) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }

    const hunkMatch = line.match(/^@@[^@]*@@\s*(.*)$/);
    if (!hunkMatch || !currentFile) {
      continue;
    }

    const symbol = extractSymbolFromHunkContext(hunkMatch[1]);
    if (!symbol) {
      continue;
    }

    const key = `${currentFile}:${symbol}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    changed.push({
      filePath: currentFile,
      symbol,
      language: detectLanguage(currentFile)
    });
  }

  return changed;
}

export function extractSymbolFromHunkContext(context) {
  const trimmed = context.trim();
  if (!trimmed) {
    return "";
  }

  const patterns = [
    /^function\s+([A-Za-z_$][\w$]*(?:[.:][A-Za-z_$][\w$]*)*)\s*\(/,
    /^(?:local\s+)?function\s+([A-Za-z_$][\w$]*(?:[.:][A-Za-z_$][\w$]*)*)/,
    /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/,
    /^(?:public|private|protected|static|virtual|inline|constexpr|friend|extern|\s)*[\w:<>,~*&\s]+\s+([A-Za-z_~][\w:~]*)\s*\([^;]*\)\s*(?:const\s*)?(?:\{|$)/,
    /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
    /^([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{?$/
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return cleanupSymbol(match[1]);
    }
  }

  return "";
}

export function detectLanguage(filePath) {
  const lower = filePath.toLowerCase();
  const ext = lower.match(/\.[^.\\/]+$/)?.[0] ?? "";
  return LANGUAGE_BY_EXTENSION.get(ext) ?? "unknown";
}

function cleanupSymbol(symbol) {
  return symbol.replace(/^[*&\s]+/, "").replace(/\s+/g, " ").trim();
}
