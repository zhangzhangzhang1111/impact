export function renderMarkdownReport(report) {
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
  const impactRows = report.impactFunctions.map((item) => `
          <tr>
            <td>${escapeHtml(String(item.depth))}</td>
            <td>${escapeHtml(item.symbol)}</td>
            <td>${escapeHtml(item.filePath ?? "")}</td>
            <td>${escapeHtml(item.reason)}</td>
          </tr>`).join("");
  const changedItems = report.changedFunctions.map((item) => `
          <li><strong>${escapeHtml(item.symbol)}</strong><span>${escapeHtml(item.filePath)} · ${escapeHtml(item.language)}</span></li>`).join("");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(report.title)}</title>
    <style>
      body { margin: 0; font-family: Arial, "Microsoft YaHei", sans-serif; color: #17202a; background: #f6f8fb; }
      main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
      header { border-bottom: 1px solid #d7dde8; padding-bottom: 18px; margin-bottom: 24px; }
      h1 { margin: 0 0 12px; font-size: 30px; }
      h2 { margin-top: 30px; font-size: 20px; }
      .meta { display: flex; flex-wrap: wrap; gap: 10px; color: #52616f; }
      .pill { background: #e9eef5; border-radius: 6px; padding: 6px 10px; }
      ul.changed { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; padding: 0; list-style: none; }
      ul.changed li { background: white; border: 1px solid #dfe5ee; border-radius: 8px; padding: 12px; }
      ul.changed span { display: block; color: #64748b; margin-top: 5px; word-break: break-all; }
      table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #dfe5ee; }
      th, td { padding: 10px 12px; border-bottom: 1px solid #edf1f6; text-align: left; vertical-align: top; }
      th { background: #eef3f8; font-size: 13px; text-transform: uppercase; color: #475569; }
      .section { background: white; border: 1px solid #dfe5ee; border-radius: 8px; padding: 16px; }
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
        <h2>Business Function Impact Analysis</h2>
        <div class="section">${escapeHtml(report.aiAnalysis.impactSummary).replace(/\n/g, "<br>")}</div>
      </section>
      <section>
        <h2>Business Function Test Checklist</h2>
        <div class="section"><ul>${report.aiAnalysis.testSuggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      </section>
      <section>
        <h2>Code Review</h2>
        <div class="section"><ul>${report.aiAnalysis.reviewFindings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      </section>
      <section>
        <h2>Git Diff</h2>
        <pre class="section">${escapeHtml(report.diffText ?? "")}</pre>
      </section>
    </main>
  </body>
</html>`;
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
