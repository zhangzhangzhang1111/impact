# impact

`impact` is a zero-runtime-dependency Node.js MCP service for code impact analysis. It reads git diffs, extracts changed function symbols, uses CodeGraph for two-layer caller analysis, optionally sends the bounded impact context to an OpenAI-compatible model, and generates Markdown plus standalone HTML reports.

## Install

Run directly from GitHub with npx:

```bash
npx github:zhangzhangzhang1111/impact --mcp
```

Or install globally from GitHub:

```bash
npm install -g github:zhangzhangzhang1111/impact
impact-mcp install
```

The package name is `@impact-analyzer/mcp`, but it has not been published to the
public npm registry yet. After publishing, the registry command will be:
`npm install -g @impact-analyzer/mcp`.

Node.js 20 or newer is required. The target machine also needs `git`, `codegraph`, and `rg` for fallback text search when CodeGraph cannot resolve a language/symbol.

`npm install` only installs the executable. Run `impact-mcp install` after that
to choose which AI tool should receive the MCP configuration.

Non-interactive examples:

```bash
impact-mcp install --target codex
impact-mcp install --target claude,gemini
impact-mcp install --target all
impact-mcp install --print-config codex
```

## MCP Tool

Tool name: `analyze_code_impact`

Input:

```json
{
  "path": "D:/your-project",
  "branch": "feature/login",
  "beforeCommit": "origin/master",
  "afterCommit": "HEAD",
  "outputDir": "impact-report",
  "config": "D:/your-project/impact.config.json"
}
```

`path` is required. `branch`, `beforeCommit`, and `afterCommit` are optional. When commits are omitted, the service compares `origin/master` with `branch` or `HEAD`.

The service stops immediately on errors and returns the error reason. It does not modify or delete source code. It does run `codegraph init -i <project>` in the target project so CodeGraph can create/update its `.codegraph` index.

## CLI

```bash
impact-mcp --path D:/your-project --before-commit origin/master --after-commit HEAD
```

Outputs:

- `impact-report/impact-report.md`
- `impact-report/impact-report.html`

## AI Analysis

AI is optional but supported through an OpenAI-compatible chat completions API. Context is bounded before the request to avoid overly long prompts.

Environment variables:

```bash
IMPACT_AI_API_KEY=...
IMPACT_AI_ENDPOINT=https://api.openai.com/v1/chat/completions
IMPACT_AI_MODEL=gpt-4.1-mini
```

If AI is not configured, the service emits a deterministic local summary plus the configured review rules.

## Configuration

Create `impact.config.json` in the target project, or pass `--config`.

```json
{
  "remoteMaster": "origin/master",
  "outputDir": "impact-report",
  "codegraphDepth": 2,
  "codegraphLimit": 30,
  "businessNotes": [
    "Payment changes must include rollback and reconciliation checks."
  ],
  "reviewRules": [
    "Project-specific rule: RPC schema changes must remain backward compatible."
  ],
  "ai": {
    "enabled": true,
    "model": "gpt-4.1-mini",
    "maxChangedFunctions": 60,
    "maxImpactFunctions": 80
  }
}
```

Default review rules include Lua and C/C++ checks for nil handling, ownership, lifetime, bounds, concurrency, ABI compatibility, and cross-language boundaries.

## MCP Client Examples

Codex:

```json
{
  "mcpServers": {
    "impact": {
      "command": "npx",
      "args": ["github:zhangzhangzhang1111/impact", "--mcp"]
    }
  }
}
```

Codex TOML snippet:

```toml
[mcp_servers.impact]
command = "npx"
args = ["github:zhangzhangzhang1111/impact", "--mcp"]
```

Claude Desktop:

```json
{
  "mcpServers": {
    "impact": {
      "command": "npx",
      "args": ["github:zhangzhangzhang1111/impact", "--mcp"]
    }
  }
}
```

Gemini CLI or other MCP clients can use the same command/args pair.

## Language Support

Function extraction supports common hunk header formats for Lua, C, C++, JS/TS, Go, Rust, Java, Kotlin, Python, Ruby, PHP, and C#. CodeGraph handles the precise structural call graph for languages it supports. Unsupported or unresolved symbols degrade to `rg`-based text search for a conservative caller hint.
