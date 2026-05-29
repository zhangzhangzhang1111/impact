---
name: code-impact-review
description: Use when the user asks for AI impact analysis, impact review, code review by changed functions, caller-chain analysis, risk-based test plans, or reports from git diff. Supports project path, branch, optional before/after commits, LuaLS MCP for Lua callers, CodeGraph fallback/other-language callers, AI synthesis, Markdown/HTML/JSON/prompt artifacts, and Codex/Claude/Gemini/Cursor MCP usage.
---

# Code Impact Review

Use this skill to analyze how a code change affects business behavior and caller chains, then generate review-ready artifacts.

All user-facing reports must be written in Chinese. Do not only summarize the analysis in chat: every analysis run must create local report artifacts and return their file paths to the user.

## Quick Start

Prefer the bundled MCP tool when available:

```json
{
  "tool": "analyze_code_impact",
  "arguments": {
    "path": "/absolute/project/path",
    "branch": "feature/my-change",
    "beforeCommit": "origin/master",
    "afterCommit": "HEAD"
  }
}
```

If the MCP tool is not available, run the CLI:

```bash
npx github:zhangzhangzhang1111/impact --path /absolute/project/path --before-commit origin/master --after-commit HEAD
```

When `beforeCommit` and `afterCommit` are omitted, compare `origin/master` to `branch` or `HEAD`.

## Workflow

1. Confirm the target project path and optional `branch`, `beforeCommit`, `afterCommit`, `outputDir`, and config path.
2. Run `analyze_code_impact` through MCP or the CLI.
3. Use the generated artifacts:
   - `.md`: human-readable Chinese report
   - `.html`: standalone visual report
   - `.json`: structured AI/human evidence
   - `.prompt.md`: continuation prompt for Codex, Claude, Gemini, or another AI reviewer
   If the MCP tool is unavailable, run the CLI instead so the artifacts are still written locally.
4. Review the output sections:
   - 总览
   - 影响面分析结果（风险等级划分）
   - 功能测试
   - 代码评审
   - Git Diff（按文件默认折叠）
5. For Lua changes, prefer the LuaLS MCP server (`luals_request` with `textDocument/references`) for caller/reference impact. If LuaLS MCP is unavailable, keep CodeGraph or fallback caller hints and mention the reduced confidence.
6. For non-Lua changes, use CodeGraph two-layer callers and fallback hints when CodeGraph cannot resolve a symbol.

## Review Focus

For Lua:

- nil handling and missing field access
- table mutation side effects
- coroutine/yield safety
- module global pollution
- error propagation and rollback behavior

For C/C++:

- ownership, lifetime, and null checks
- bounds and integer overflow
- thread safety and reentrancy
- ABI/API compatibility
- error-code handling and resource cleanup

For cross-language boundaries:

- serialization contracts
- memory ownership across boundaries
- backward compatibility
- rollback and recovery paths

## Expected Output

When responding to the user, include:

- report file paths returned by MCP/CLI
- the highest-risk changed or impacted functions
- test areas that should be run first
- any LuaLS MCP, CodeGraph, or AI configuration limitations

Never replace the local report files with a chat-only analysis. The final answer should explicitly mention the Markdown, HTML, JSON, and prompt artifact paths.
