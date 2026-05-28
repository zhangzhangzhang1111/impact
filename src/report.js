export function renderMarkdownReport(report) {
  const testChecklist = buildTestChecklist(report.impactFunctions);
  return [
    `# ${report.title}`,
    "",
    "## Overview",
    `- Project: ${report.repository}`,
    `- Branch: ${report.headRef}`,
    `- Base: ${report.baseRef}`,
    `- Generated At: ${report.generatedAt ?? ""}`,
    `- Changed Functions: ${report.changedFunctions.length}`,
    `- Impact Functions: ${report.impactFunctions.length}`,
    "",
    "## Changed Functions",
    table(["Symbol", "File", "Language"], report.changedFunctions.map((item) => [
      item.symbol,
      item.filePath,
      item.language
    ])),
    "",
    "## Impact Functions",
    table(["Depth", "Symbol", "File", "Reason"], report.impactFunctions.map((item) => [
      String(item.depth),
      item.symbol,
      item.filePath ?? "",
      item.reason
    ])),
    "",
    "## Business Function Impact Analysis",
    report.aiAnalysis.impactSummary,
    "",
    "## Business Function Test Checklist",
    table(["Risk", "Function", "Test Suggestion", "Reason"], testChecklist.map((item) => [
      item.risk,
      item.symbol,
      item.suggestion,
      item.reason
    ])),
    "",
    "### Additional AI Test Suggestions",
    bulletList(report.aiAnalysis.testSuggestions),
    "",
    "## Code Review",
    bulletList(report.aiAnalysis.reviewFindings),
    "",
    "## Git Diff",
    "```diff",
    report.diffText ?? "",
    "```",
    ""
  ].join("\n");
}

export function renderHtmlReport(report) {
  const testChecklist = buildTestChecklist(report.impactFunctions);
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
            <td><span class="risk-badge risk-${escapeHtml(item.risk.toLowerCase())}">${escapeHtml(item.risk)}</span></td>
            <td>${escapeHtml(item.symbol)}</td>
            <td>${escapeHtml(item.suggestion)}</td>
            <td>${escapeHtml(item.reason)}</td>
          </tr>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(report.title)}</title>
    <style>
      :root { --bg: #0f1117; --panel: #1a1d27; --panel2: #252836; --border: #2e3347; --text: #e2e8f0; --muted: #94a3b8; --red: #ef4444; --orange: #f59e0b; --blue: #3b82f6; --green: #22c55e; }
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
      th { background: var(--panel2); font-size: 13px; text-transform: uppercase; color: var(--muted); }
      .section { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
      .risk-badge { padding: 2px 9px; border-radius: 4px; font-size: 11px; font-weight: 700; display: inline-block; }
      .risk-high { background: rgba(239,68,68,.15); color: var(--red); border: 1px solid rgba(239,68,68,.3); }
      .risk-medium { background: rgba(245,158,11,.15); color: var(--orange); border: 1px solid rgba(245,158,11,.3); }
      .risk-low { background: rgba(59,130,246,.15); color: var(--blue); border: 1px solid rgba(59,130,246,.3); }
      details { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; margin-top: 22px; overflow: hidden; }
      summary { cursor: pointer; padding: 14px 16px; font-weight: 700; }
      details > .details-body { padding: 0 16px 16px; }
      pre { overflow: auto; scrollbar-gutter: stable; }
      li { margin: 7px 0; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(report.title)}</h1>
        <div class="meta">
          <span class="pill">Project: ${escapeHtml(report.repository)}</span>
          <span class="pill">Branch: ${escapeHtml(report.headRef)}</span>
          <span class="pill">Base: ${escapeHtml(report.baseRef)}</span>
          <span class="pill">Generated: ${escapeHtml(report.generatedAt ?? "")}</span>
        </div>
        <div class="cards">
          <div class="card"><div class="label">Changed</div><div class="value">${escapeHtml(String(report.changedFunctions.length))}</div></div>
          <div class="card"><div class="label">Impacted</div><div class="value">${escapeHtml(String(report.impactFunctions.length))}</div></div>
          <div class="card"><div class="label">High Risk</div><div class="value">${escapeHtml(String(testChecklist.filter((item) => item.risk === "High").length))}</div></div>
          <div class="card"><div class="label">Medium Risk</div><div class="value">${escapeHtml(String(testChecklist.filter((item) => item.risk === "Medium").length))}</div></div>
        </div>
      </header>
      <section>
        <h2>Overview</h2>
        <div class="section">
          Changed functions: ${escapeHtml(String(report.changedFunctions.length))}<br>
          Impact functions: ${escapeHtml(String(report.impactFunctions.length))}
        </div>
      </section>
      <section>
        <h2>Changed Functions</h2>
        <ul class="changed">${changedItems}</ul>
      </section>
      <section>
        <h2>Impact Functions</h2>
        <table>
          <thead><tr><th>Depth</th><th>Symbol</th><th>File</th><th>Reason</th></tr></thead>
          <tbody>${impactRows}</tbody>
        </table>
      </section>
      <section>
        <h2>业务功能影响面分析</h2>
        <div class="section">${escapeHtml(report.aiAnalysis.impactSummary).replace(/\n/g, "<br>")}</div>
      </section>
      <section>
        <h2>业务功能测试清单</h2>
        <table>
          <thead><tr><th>Risk</th><th>Function</th><th>Test Suggestion</th><th>Reason</th></tr></thead>
          <tbody>${testRows}</tbody>
        </table>
        <div class="section"><strong>Additional AI Suggestions</strong><ul>${report.aiAnalysis.testSuggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      </section>
      <section>
        <h2>Code Review</h2>
        <div class="section"><ul>${report.aiAnalysis.reviewFindings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      </section>
      <details>
        <summary>Git Diff</summary>
        <div class="details-body"><pre class="section" tabindex="0"><code>${escapeHtml(report.diffText ?? "")}</code></pre></div>
      </details>
    </main>
  </body>
</html>`;
}

export function buildTestChecklist(impactFunctions) {
  return impactFunctions.map((item) => {
    const risk = item.depth === 0 ? "High" : item.depth === 1 ? "Medium" : "Low";
    const suggestion = item.depth === 0
      ? "Verify changed function behavior, boundary inputs, and rollback/error paths."
      : item.depth === 1
        ? "Verify direct caller workflow and integration data contract."
        : "Run regression smoke test for indirect impacted workflow.";
    return {
      risk,
      symbol: item.symbol,
      suggestion,
      reason: item.reason
    };
  });
}

export function buildReportFileNames(project, branch, timestamp = new Date().toISOString()) {
  const base = `${sanitizeName(project)}_${sanitizeName(branch)}_${formatTimestamp(timestamp)}`;
  return {
    markdownFileName: `${base}.md`,
    htmlFileName: `${base}.html`
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
