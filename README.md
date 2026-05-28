# impact

`impact` is a zero-runtime-dependency Node.js MCP service for code impact analysis. It reads git diffs, extracts changed function symbols, uses CodeGraph for two-layer caller analysis, sends bounded diff/source/caller context to an OpenAI-compatible model when configured, and generates Markdown, standalone HTML, JSON, and AI prompt artifacts.

The repository is also packaged as a Codex plugin/skill:

- `.codex-plugin/plugin.json` exposes the plugin metadata.
- `.mcp.json` exposes the `impact` MCP server.
- `skills/code-impact-review/SKILL.md` provides the AI-facing skill workflow.

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
impact-mcp install --target codex --output-dir D:/impact-reports
impact-mcp install --print-config codex
```

Install the skill instructions as well:

```bash
impact-mcp install-skill --target codex
impact-mcp install-skill --target claude,gemini
impact-mcp install-skill --target all
impact-mcp install-skill --print-instructions codex
```

Skill install targets:

- `codex`: copies `skills/code-impact-review` to `~/.codex/skills/code-impact-review`
- `claude`: copies `skills/code-impact-review` to `~/.claude/skills/code-impact-review`
- `gemini`: writes a managed `code-impact-review` instruction block to `~/.gemini/GEMINI.md`
- `cursor`: writes a Cursor rule to `~/.cursor/rules/code-impact-review.mdc`

For Codex plugin installation from a local checkout, point Codex at this repository root as a plugin source; the plugin manifest is in `.codex-plugin/plugin.json`.

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

- `<outputDir>/<project>_<branch>_<timestamp>.md`
- `<outputDir>/<project>_<branch>_<timestamp>.html`
- `<outputDir>/<project>_<branch>_<timestamp>.json`
- `<outputDir>/<project>_<branch>_<timestamp>.prompt.md`

When `outputDir` is not specified, reports are generated under
`<analyzed-project>/impact-report`. The generated report is Chinese and includes:

- 总览
- 变更函数和两层调用影响函数
- 业务功能影响面分析和风险等级划分
- 业务功能测试清单，覆盖所有影响函数并标注高/中/低风险等级
- 代码评审
- Git Diff，Markdown 和 HTML 都按文件默认折叠展示

The JSON artifact contains structured metadata, changed functions, per-function diff snippets, CodeGraph impact functions, collected source snippets, risk assessment, test suggestions, and review findings. The prompt artifact is designed for Codex, Claude, Gemini, or another AI reviewer to continue deeper analysis from the same evidence.

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
  "sourceContextRadius": 8,
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
    "maxImpactFunctions": 80,
    "maxSourceContexts": 80
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

If you install with a default report directory:

```bash
impact-mcp install --target codex --output-dir D:/impact-reports
```

Codex config includes:

```toml
[mcp_servers.impact]
command = "npx"
args = ["github:zhangzhangzhang1111/impact", "--mcp"]

[mcp_servers.impact.env]
IMPACT_OUTPUT_DIR = "D:/impact-reports"
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
