export function renderMarkdownReport(report) {
  const testChecklist = buildTestChecklist(report.impactFunctions);
  const riskAssessments = normalizeRiskAssessments(report);
  const diffFiles = splitDiffByFile(report.diffText ?? "");
  return [
    "# 代码影响面分析报告",
    "",
    "## 总览",
    `- 项目: ${report.repository}`,
    `- 分支: ${report.headRef}`,
    `- 基线: ${report.baseRef}`,
    `- 生成时间: ${report.generatedAt ?? ""}`,
    `- 变更函数: ${report.changedFunctions.length}`,
    `- 影响函数: ${report.impactFunctions.length}`,
    "",
    "## 变更函数",
    table(["函数", "文件", "语言"], report.changedFunctions.map((item) => [
      item.symbol,
      item.filePath,
      item.language
    ])),
    "",
    "## 影响函数",
    table(["层级", "函数", "文件", "原因"], report.impactFunctions.map((item) => [
      String(item.depth),
      item.symbol,
      item.filePath ?? "",
      item.reason
    ])),
    "",
    "## 业务功能影响面分析",
    report.aiAnalysis.impactSummary,
    "",
    "## 影响面分析结果（风险等级划分）",
    table(["风险", "函数", "原因", "证据"], riskAssessments.map((item) => [
      item.risk,
      item.symbol,
      item.reason,
      item.evidence
    ])),
    "",
    "## 业务功能测试清单",
    table(["风险", "函数", "测试建议", "原因"], testChecklist.map((item) => [
      item.risk,
      item.symbol,
      item.suggestion,
      item.reason
    ])),
    "",
    "### 大模型补充测试建议",
    bulletList(report.aiAnalysis.testSuggestions),
    "",
    "## 代码评审",
    bulletList(report.aiAnalysis.reviewFindings),
    "",
    "## Git Diff（按文件）",
    ...diffFiles.flatMap((file) => [
      "",
      `<details><summary>${escapeMarkdownText(file.filePath)}</summary>`,
      "",
      "```diff",
      file.diffText,
      "```",
      "",
      "</details>"
    ]),
    ""
  ].join("\n");
}

export function renderHtmlReport(report) {
  const testChecklist = buildTestChecklist(report.impactFunctions);
  const riskAssessments = normalizeRiskAssessments(report);
  const diffFiles = splitDiffByFile(report.diffText ?? "");
  const impactRows = report.impactFunctions.map((item) => `
          <tr>
            <td>${escapeHtml(String(item.depth))}</td>
            <td>${escapeHtml(item.symbol)}</td>
            <td>${escapeHtml(item.filePath ?? "")}</td>
            <td>${escapeHtml(item.reason)}</td>
          </tr>`).join("");
  const changedItems = report.changedFunctions.map((item) => `
          <li><strong>${escapeHtml(item.symbol)}</strong><span>${escapeHtml(item.filePath)} · ${escapeHtml(item.language)}</span></li>`).join("");
  const testRows = testChecklist.map((item) => `
          <tr>
            <td><span class="risk-badge risk-${escapeHtml(riskClass(item.risk))}">${escapeHtml(item.risk)}</span></td>
            <td>${escapeHtml(item.symbol)}</td>
            <td>${escapeHtml(item.suggestion)}</td>
            <td>${escapeHtml(item.reason)}</td>
          </tr>`).join("");
  const riskRows = riskAssessments.map((item) => `
          <tr>
            <td><span class="risk-badge risk-${escapeHtml(riskClass(item.risk))}">${escapeHtml(item.risk)}</span></td>
            <td>${escapeHtml(item.symbol)}</td>
            <td>${escapeHtml(item.reason)}</td>
            <td>${escapeHtml(item.evidence)}</td>
          </tr>`).join("");
  const diffDetails = diffFiles.map((file) => `
          <details class="diff-file">
            <summary>${escapeHtml(file.filePath)}</summary>
            <pre tabindex="0"><code>${escapeHtml(file.diffText)}</code></pre>
          </details>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>代码影响面分析报告</title>
    <style>
      :root { --bg: #0f1117; --panel: #1a1d27; --panel2: #252836; --border: #2e3347; --text: #e2e8f0; --muted: #94a3b8; --red: #ef4444; --orange: #f59e0b; --blue: #3b82f6; }
      body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; color: var(--text); background: var(--bg); }
      main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
      header { border-bottom: 1px solid var(--border); padding-bottom: 18px; margin-bottom: 24px; }
      h1 { margin: 0 0 12px; font-size: 30px; }
      h2 { margin-top: 30px; font-size: 20px; }
      .meta { display: flex; flex-wrap: wrap; gap: 10px; color: var(--muted); }
      .pill { background: var(--panel2); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; }
      .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin: 22px 0; }
      .card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
      .card .label { color: var(--muted); font-size: 12px; text-transform: uppercase; }
      .card .value { font-size: 26px; font-weight: 700; margin-top: 4px; }
      ul.changed { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; padding: 0; list-style: none; }
      ul.changed li { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
      ul.changed span { display: block; color: var(--muted); margin-top: 5px; word-break: break-all; }
      table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--border); }
      th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
      th { background: var(--panel2); font-size: 13px; color: var(--muted); }
      .section { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
      .risk-badge { padding: 2px 9px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; }
      .risk-high { background: rgba(239,68,68,.15); color: var(--red); border: 1px solid rgba(239,68,68,.3); }
      .risk-medium { background: rgba(245,158,11,.15); color: var(--orange); border: 1px solid rgba(245,158,11,.3); }
      .risk-low { background: rgba(59,130,246,.15); color: var(--blue); border: 1px solid rgba(59,130,246,.3); }
      .diff-file { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; margin: 10px 0; }
      .diff-file summary { cursor: pointer; padding: 12px 14px; color: #93c5fd; overflow-wrap: anywhere; }
      .diff-file pre { margin: 0; border-top: 1px solid var(--border); padding: 14px; }
      pre { overflow: auto; scrollbar-gutter: stable; }
      li { margin: 7px 0; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>代码影响面分析报告</h1>
        <div class="meta">
          <span class="pill">项目: ${escapeHtml(report.repository)}</span>
          <span class="pill">分支: ${escapeHtml(report.headRef)}</span>
          <span class="pill">基线: ${escapeHtml(report.baseRef)}</span>
          <span class="pill">生成时间: ${escapeHtml(report.generatedAt ?? "")}</span>
        </div>
        <div class="cards">
          <div class="card"><div class="label">变更函数</div><div class="value">${escapeHtml(String(report.changedFunctions.length))}</div></div>
          <div class="card"><div class="label">影响函数</div><div class="value">${escapeHtml(String(report.impactFunctions.length))}</div></div>
          <div class="card"><div class="label">高风险</div><div class="value">${escapeHtml(String(testChecklist.filter((item) => item.risk === "高").length))}</div></div>
          <div class="card"><div class="label">中风险</div><div class="value">${escapeHtml(String(testChecklist.filter((item) => item.risk === "中").length))}</div></div>
        </div>
      </header>
      <section>
        <h2>总览</h2>
        <div class="section">变更函数: ${escapeHtml(String(report.changedFunctions.length))}<br>影响函数: ${escapeHtml(String(report.impactFunctions.length))}</div>
      </section>
      <section>
        <h2>变更函数</h2>
        <ul class="changed">${changedItems}</ul>
      </section>
      <section>
        <h2>影响函数</h2>
        <table>
          <thead><tr><th>层级</th><th>函数</th><th>文件</th><th>原因</th></tr></thead>
          <tbody>${impactRows}</tbody>
        </table>
      </section>
      <section>
        <h2>业务功能影响面分析</h2>
        <div class="section">${escapeHtml(report.aiAnalysis.impactSummary).replace(/\n/g, "<br>")}</div>
      </section>
      <section>
        <h2>影响面分析结果（风险等级划分）</h2>
        <table>
          <thead><tr><th>风险</th><th>函数</th><th>原因</th><th>证据</th></tr></thead>
          <tbody>${riskRows}</tbody>
        </table>
      </section>
      <section>
        <h2>业务功能测试清单</h2>
        <table>
          <thead><tr><th>风险</th><th>函数</th><th>测试建议</th><th>原因</th></tr></thead>
          <tbody>${testRows}</tbody>
        </table>
        <div class="section"><strong>大模型补充测试建议</strong><ul>${report.aiAnalysis.testSuggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      </section>
      <section>
        <h2>代码评审</h2>
        <div class="section"><ul>${report.aiAnalysis.reviewFindings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      </section>
      <section>
        <h2>Git Diff（按文件）</h2>
        <div class="section">
          ${diffDetails}
        </div>
      </section>
    </main>
  </body>
</html>`;
}

export function renderJsonArtifact(report) {
  return `${JSON.stringify({
    meta: {
      title: report.title,
      repository: report.repository,
      baseRef: report.baseRef,
      headRef: report.headRef,
      generatedAt: report.generatedAt
    },
    changes: {
      changedFunctions: report.changedFunctions,
      functionDiffs: report.functionDiffs ?? [],
      diffByFile: splitDiffByFile(report.diffText ?? "")
    },
    callGraph: {
      depth: 2,
      impactFunctions: report.impactFunctions,
      sourceContexts: report.sourceContexts ?? []
    },
    review: {
      impactSummary: report.aiAnalysis.impactSummary,
      riskAssessments: normalizeRiskAssessments(report),
      testSuggestions: report.aiAnalysis.testSuggestions ?? [],
      reviewFindings: report.aiAnalysis.reviewFindings ?? []
    }
  }, null, 2)}\n`;
}

export function renderAiPrompt(report, config = {}) {
  return [
    "# AI 影响面分析 Prompt",
    "",
    "请基于以下结构化上下文继续深化影响面分析、业务功能测试报告和代码评审。",
    "",
    "## 仓库与范围",
    `- 项目: ${report.repository}`,
    `- 基线: ${report.baseRef}`,
    `- 目标: ${report.headRef}`,
    `- 生成时间: ${report.generatedAt ?? ""}`,
    "",
    "## 输出要求",
    "- 输出中文 Markdown。",
    "- 必须包含总览、影响面分析结果（风险等级划分）、功能测试、代码评审、Git Diff 复核建议。",
    "- 代码评审优先覆盖 C/C++ 与 Lua：空值/nil、资源所有权、生命周期、越界、并发、ABI/API 兼容、错误传播、跨语言边界。",
    "",
    "## 项目补充规则",
    bulletList(config.reviewRules ?? []),
    "",
    "## 上下文 JSON",
    "```json",
    renderJsonArtifact(report).trimEnd(),
    "```",
    ""
  ].join("\n");
}

export function buildTestChecklist(impactFunctions) {
  return impactFunctions.map((item) => {
    const risk = item.depth === 0 ? "高" : item.depth === 1 ? "中" : "低";
    const suggestion = item.depth === 0
      ? "验证变更函数行为、边界输入、异常路径和回滚路径。"
      : item.depth === 1
        ? "验证直接调用方业务流程、集成数据契约和关键联动场景。"
        : "执行间接受影响业务流程的冒烟回归。";
    return {
      risk,
      symbol: item.symbol,
      suggestion,
      reason: item.reason
    };
  });
}

export function normalizeRiskAssessments(report) {
  const aiRisks = Array.isArray(report.aiAnalysis?.riskAssessments)
    ? report.aiAnalysis.riskAssessments
    : [];
  const bySymbol = new Map();
  for (const item of aiRisks) {
    if (!item?.symbol) {
      continue;
    }
    bySymbol.set(item.symbol, {
      risk: normalizeRisk(item.risk),
      symbol: item.symbol,
      reason: item.reason ?? "AI 综合影响面判断。",
      evidence: item.evidence ?? ""
    });
  }

  return report.impactFunctions.map((item) => bySymbol.get(item.symbol) ?? {
    risk: item.depth === 0 ? "高" : item.depth === 1 ? "中" : "低",
    symbol: item.symbol,
    reason: item.depth === 0
      ? "变更函数本身需要最高优先级验证。"
      : item.depth === 1
        ? "直接调用方可能继承接口、数据或异常语义变化。"
        : "二层调用方存在间接业务回归风险。",
    evidence: item.reason
  });
}

export function splitDiffByFile(diffText) {
  const files = [];
  let current = null;
  for (const line of String(diffText || "").split(/\r?\n/)) {
    const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (match) {
      current = { filePath: match[2], lines: [line] };
      files.push(current);
      continue;
    }
    if (!current) {
      current = { filePath: "unknown", lines: [] };
      files.push(current);
    }
    current.lines.push(line);
  }
  return files
    .map((file) => ({ filePath: file.filePath, diffText: file.lines.join("\n") }))
    .filter((file) => file.diffText.trim());
}

export function buildReportFileNames(project, branch, timestamp = new Date().toISOString()) {
  const base = `${sanitizeName(project)}_${sanitizeName(branch)}_${formatTimestamp(timestamp)}`;
  return {
    markdownFileName: `${base}.md`,
    htmlFileName: `${base}.html`,
    jsonFileName: `${base}.json`,
    promptFileName: `${base}.prompt.md`
  };
}

function table(headers, rows) {
  if (rows.length === 0) {
    return "_No data._";
  }
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeMarkdownCell).join(" | ")} |`)
  ].join("\n");
}

function bulletList(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- No suggestions.";
}

function escapeMarkdownCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function escapeMarkdownText(value) {
  return String(value).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normalizeRisk(value) {
  if (value === "高" || value === "high" || value === "HIGH") {
    return "高";
  }
  if (value === "中" || value === "medium" || value === "MEDIUM") {
    return "中";
  }
  return "低";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeName(value) {
  return String(value || "unknown").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "_");
}

function riskClass(risk) {
  return risk === "高" ? "high" : risk === "中" ? "medium" : "low";
}
