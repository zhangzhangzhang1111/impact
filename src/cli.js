#!/usr/bin/env node
import { runImpactAnalysis } from "./analyzer.js";
import { startMcpServer } from "./server.js";

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
} else if (args.version || args.v) {
  console.log("0.1.0");
} else if (args.mcp || args._[0] === "mcp") {
  startMcpServer();
} else {
  runImpactAnalysis({
    path: args.path ?? args._[0],
    branch: args.branch,
    beforeCommit: args.beforeCommit,
    afterCommit: args.afterCommit,
    outputDir: args.outputDir,
    config: args.config
  }).then((result) => {
    console.log(JSON.stringify({
      markdownPath: result.output.markdownPath,
      htmlPath: result.output.htmlPath,
      changedFunctionCount: result.changedFunctions.length,
      impactFunctionCount: result.impactFunctions.length
    }, null, 2));
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

function printHelp() {
  console.log(`Usage: impact-mcp [options] [path]

Options:
  --mcp                       Start as an MCP stdio server
  --path <path>               Target project path
  --branch <ref>              Optional head branch/ref
  --before-commit <ref>       Optional base commit/ref, defaults to origin/master
  --after-commit <ref>        Optional head commit/ref, defaults to branch or HEAD
  --output-dir <dir>          Optional report output directory
  --config <path>             Optional impact config JSON path
  --version, -v               Print version
  --help, -h                  Print help`);
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
