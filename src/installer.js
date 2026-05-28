import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { homedir, platform } from "node:os";

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

export function buildServerConfig(options = {}) {
  const config = {
    command: "npx",
    args: ["github:zhangzhangzhang1111/impact", "--mcp"]
  };
  if (options.outputDir) {
    config.env = { IMPACT_OUTPUT_DIR: options.outputDir };
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
