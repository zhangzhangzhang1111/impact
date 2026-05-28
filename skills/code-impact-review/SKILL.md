---
name: code-impact-review
description: Use when the user asks for AI impact analysis, impact review, code review by changed functions, caller-chain analysis, risk-based test plans, or reports from git diff. Supports project path, branch, optional before/after commits, CodeGraph two-layer callers, AI synthesis, Markdown/HTML/JSON/prompt artifacts, and Codex/Claude/Gemini/Cursor MCP usage.
---

# Code Impact Review

Use this skill to analyze how a code change affects business behavior and caller chains, then generate review-ready artifacts.

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
4. Review the output sections:
   - 总览
   - 影响面分析结果（风险等级划分）
   - 功能测试
   - 代码评审
   - Git Diff（按文件默认折叠）
5. If CodeGraph cannot resolve a symbol, keep the fallback caller hints but mention the reduced confidence.

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
- any CodeGraph or AI configuration limitations
