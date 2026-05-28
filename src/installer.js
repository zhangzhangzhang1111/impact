import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { homedir, platform } from "node:os";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_NAME = "code-impact-review";

const TARGETS = [
  {
    id: "codex",
    name: "Codex",
    type: "toml",
    path: () => join(homedir(), ".codex", "config.toml")
  },
  {
    id: "claude",
    name: "Claude Desktop",
    type: "json",
    path: () => platform() === "win32"
      ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
      : platform() === "darwin"
        ? join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json")
        : join(homedir(), ".config", "Claude", "claude_desktop_config.json")
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    type: "json",
    path: () => join(homedir(), ".gemini", "settings.json")
  },
  {
    id: "cursor",
    name: "Cursor",
    type: "json",
    path: () => join(homedir(), ".cursor", "mcp.json")
  }
];

const SKILL_TARGETS = [
  {
    id: "codex",
    name: "Codex",
    type: "skill-dir",
    path: () => join(homedir(), ".codex", "skills", SKILL_NAME)
  },
  {
    id: "claude",
    name: "Claude",
    type: "skill-dir",
    path: () => join(homedir(), ".claude", "skills", SKILL_NAME)
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    type: "instruction-file",
    path: () => join(homedir(), ".gemini", "GEMINI.md")
  },
  {
    id: "cursor",
    name: "Cursor",
    type: "cursor-rule",
    path: () => join(homedir(), ".cursor", "rules", `${SKILL_NAME}.mdc`)
  }
];

export async function runInstallCommand(args, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stdin = io.stdin ?? process.stdin;
  const targetId = args.target || args.t;
  const serverConfig = buildServerConfig({ outputDir: args.outputDir });
  if (args.printConfig) {
    const target = getTarget(args.printConfig);
    stdout.write(`${formatConfigSnippet(target, serverConfig)}\n`);
    return;
  }

  const targets = targetId
    ? parseTargets(targetId)
    : await promptTargets(stdin, stdout);

  for (const target of targets) {
    installTarget(target, serverConfig);
    stdout.write(`Installed impact MCP server for ${target.name}: ${target.path()}\n`);
  }
}

export async function runInstallSkillCommand(args, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stdin = io.stdin ?? process.stdin;
  const targetId = args.target || args.t;
  const skillDir = args.skillDir ? resolve(args.skillDir) : join(PACKAGE_ROOT, "skills", SKILL_NAME);
  if (args.printInstructions) {
    const printTargets = args.printInstructions === true
      ? targetId ? parseSkillTargets(targetId) : SKILL_TARGETS
      : parseSkillTargets(args.printInstructions);
    stdout.write(`${printTargets.map((target) => buildSkillInstallInstruction(target, { skillDir })).join("\n\n")}\n`);
    return;
  }

  const targets = targetId
    ? parseSkillTargets(targetId)
    : await promptSkillTargets(stdin, stdout);

  for (const target of targets) {
    installSkillTarget(target, { skillDir });
    stdout.write(`Installed ${SKILL_NAME} skill instructions for ${target.name}: ${target.path()}\n`);
  }
}

export function buildServerConfig(options = {}) {
  const config = {
    command: "npx",
    args: ["github:zhangzhangzhang1111/impact", "--mcp"],
    env: {
      IMPACT_LUALS_MCP_COMMAND: "npx",
      IMPACT_LUALS_MCP_ARGS: "github:zhangzhangzhang1111/lua-language-server luals-mcp"
    }
  };
  if (options.outputDir) {
    config.env.IMPACT_OUTPUT_DIR = options.outputDir;
  }
  return config;
}

export function getTarget(id) {
  const target = TARGETS.find((item) => item.id === id);
  if (!target) {
    throw new Error(`Unknown install target: ${id}. Supported targets: ${TARGETS.map((item) => item.id).join(", ")}`);
  }
  return target;
}

export function getSkillTarget(id) {
  const target = SKILL_TARGETS.find((item) => item.id === id);
  if (!target) {
    throw new Error(`Unknown skill install target: ${id}. Supported targets: ${SKILL_TARGETS.map((item) => item.id).join(", ")}`);
  }
  return target;
}

export function installSkillTarget(target, options = {}) {
  const skillDir = options.skillDir ?? join(PACKAGE_ROOT, "skills", SKILL_NAME);
  if (!existsSync(join(skillDir, "SKILL.md"))) {
    throw new Error(`Skill source not found: ${join(skillDir, "SKILL.md")}`);
  }

  const targetPath = target.path();
  mkdirSync(dirname(targetPath), { recursive: true });
  if (target.type === "skill-dir") {
    cpSync(skillDir, targetPath, { recursive: true, force: true });
    return;
  }

  const instruction = buildSkillInstallInstruction(target, { skillDir });
  if (target.type === "instruction-file") {
    upsertInstructionFile(targetPath, instruction, `impact:${SKILL_NAME}`);
    return;
  }
  if (target.type === "cursor-rule") {
    writeFileSync(targetPath, cursorRuleContent(instruction), "utf8");
    return;
  }
  throw new Error(`Unsupported skill target type: ${target.type}`);
}

export function buildSkillInstallInstruction(target, options = {}) {
  const skillDir = options.skillDir ?? join(PACKAGE_ROOT, "skills", SKILL_NAME);
  const skillPath = join(skillDir, "SKILL.md");
  const mcpCommand = "npx github:zhangzhangzhang1111/impact --mcp";
  return [
    `# ${SKILL_NAME} for ${target.name}`,
    "",
    `Read the skill instructions from: ${skillPath}`,
    "",
    "Use this skill when asked for AI impact analysis, changed-function review, two-layer caller impact, risk-based test planning, or code review reports.",
    "",
    "MCP server command:",
    "",
    "```bash",
    mcpCommand,
    "```",
    "",
    "Lua caller-chain provider:",
    "",
    "```bash",
    "npx github:zhangzhangzhang1111/lua-language-server luals-mcp",
    "```",
    "",
    "Primary MCP tool:",
    "",
    "```json",
    JSON.stringify({
      name: "analyze_code_impact",
      arguments: {
        path: "/absolute/project/path",
        branch: "feature/my-change",
        beforeCommit: "origin/master",
        afterCommit: "HEAD"
      }
    }, null, 2),
    "```",
    "",
    "If beforeCommit and afterCommit are omitted, compare origin/master to branch or HEAD. Return the generated Markdown, HTML, JSON, and prompt artifact paths."
  ].join("\n");
}

export function mergeJsonMcpConfig(existing, serverName, serverConfig) {
  return {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      [serverName]: serverConfig
    }
  };
}

export function upsertCodexToml(existing, serverConfig) {
  const block = [
    "[mcp_servers.impact]",
    `command = ${tomlString(serverConfig.command)}`,
    `args = [${serverConfig.args.map(tomlString).join(", ")}]`,
    ...(serverConfig.env ? [
      "",
      "[mcp_servers.impact.env]",
      ...Object.entries(serverConfig.env).map(([key, value]) => `${key} = ${tomlString(value)}`)
    ] : []),
    ""
  ].join("\n");
  const withoutOldBlock = existing
    .replace(/\n?\[mcp_servers\.impact\.env\]\n(?:[^\[]|\[(?!mcp_servers\.impact(?:\.env)?\]))*?(?=\n\[|$)/gs, "\n")
    .replace(/\n?\[mcp_servers\.impact\]\n(?:[^\[]|\[(?!mcp_servers\.impact(?:\.env)?\]))*?(?=\n\[|$)/gs, "\n");
  return `${withoutOldBlock.trimEnd()}\n\n${block}`.trimStart();
}

function installTarget(target, serverConfig) {
  const configPath = target.path();
  mkdirSync(dirname(configPath), { recursive: true });
  if (target.type === "toml") {
    const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    writeFileSync(configPath, upsertCodexToml(existing, serverConfig), "utf8");
    return;
  }
  const existing = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
  const merged = mergeJsonMcpConfig(existing, "impact", serverConfig);
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
}

function parseSkillTargets(value) {
  if (value === "all") {
    return SKILL_TARGETS;
  }
  return value.split(",").map((id) => getSkillTarget(id.trim()));
}

async function promptSkillTargets(stdin, stdout) {
  stdout.write("Choose AI tool to install code-impact-review skill instructions:\n");
  SKILL_TARGETS.forEach((target, index) => {
    stdout.write(`  ${index + 1}. ${target.name} (${target.id})\n`);
  });
  stdout.write(`  ${SKILL_TARGETS.length + 1}. All\n`);
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question("Selection: ")).trim().toLowerCase();
    if (answer === String(SKILL_TARGETS.length + 1) || answer === "all") {
      return SKILL_TARGETS;
    }
    const byNumber = Number(answer);
    if (Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= SKILL_TARGETS.length) {
      return [SKILL_TARGETS[byNumber - 1]];
    }
    return parseSkillTargets(answer);
  } finally {
    rl.close();
  }
}

function upsertInstructionFile(filePath, instruction, marker) {
  const start = `<!-- ${marker}:start -->`;
  const end = `<!-- ${marker}:end -->`;
  const block = `${start}\n${instruction}\n${end}\n`;
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, "g");
  const next = pattern.test(existing)
    ? existing.replace(pattern, block)
    : `${existing.trimEnd()}${existing.trimEnd() ? "\n\n" : ""}${block}`;
  writeFileSync(filePath, next, "utf8");
}

function cursorRuleContent(instruction) {
  return [
    "---",
    "description: AI impact analysis, caller risk, test planning, and code review reports",
    "alwaysApply: false",
    "---",
    "",
    instruction,
    ""
  ].join("\n");
}

function parseTargets(value) {
  if (value === "all") {
    return TARGETS;
  }
  return value.split(",").map((id) => getTarget(id.trim()));
}

async function promptTargets(stdin, stdout) {
  stdout.write("Choose AI tool to install impact MCP server:\n");
  TARGETS.forEach((target, index) => {
    stdout.write(`  ${index + 1}. ${target.name} (${target.id})\n`);
  });
  stdout.write("  5. All\n");
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question("Selection: ")).trim().toLowerCase();
    if (answer === "5" || answer === "all") {
      return TARGETS;
    }
    const byNumber = Number(answer);
    if (Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= TARGETS.length) {
      return [TARGETS[byNumber - 1]];
    }
    return parseTargets(answer);
  } finally {
    rl.close();
  }
}

function formatConfigSnippet(target, serverConfig) {
  if (target.type === "toml") {
    return upsertCodexToml("", serverConfig).trimEnd();
  }
  return JSON.stringify({ mcpServers: { impact: serverConfig } }, null, 2);
}

function tomlString(value) {
  return JSON.stringify(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
