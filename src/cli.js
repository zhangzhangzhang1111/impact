#!/usr/bin/env node
import { runImpactAnalysis } from "./analyzer.js";
import { startMcpServer } from "./server.js";

const args = parseArgs(process.argv.slice(2));

if (args.mcp || args._[0] === "mcp") {
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
