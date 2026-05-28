import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { analyzeWithAi } from "./ai.js";
import { initializeCodeGraph, getTwoLayerCallerMap } from "./codegraph.js";
import { loadImpactConfig } from "./config.js";
import { parseChangedFunctionsFromDiff } from "./diff-parser.js";
import { getDiffText, getRepositoryName } from "./git.js";
import { collectImpactFunctions } from "./impact-graph.js";
import { buildReportFileNames, renderHtmlReport, renderMarkdownReport } from "./report.js";

export async function runImpactAnalysis(params) {
  const projectPath = resolveRequiredPath(params.path);
  const config = loadImpactConfig(projectPath, params.config);
  const { diffText, baseRef, headRef } = await getDiffText({
    projectPath,
    branch: params.branch,
    beforeCommit: params.beforeCommit,
    afterCommit: params.afterCommit,
    remoteMaster: config.remoteMaster
  });

  const changedFunctions = parseChangedFunctionsFromDiff(diffText);
  if (changedFunctions.length === 0) {
    throw new Error(`No changed functions were found between ${baseRef} and ${headRef}.`);
  }

  await initializeCodeGraph(projectPath);
  const callerMap = await getTwoLayerCallerMap(projectPath, changedFunctions, {
    limit: config.codegraphLimit
  });
  const impactFunctions = collectImpactFunctions(changedFunctions, callerMap, config.codegraphDepth);
  const repository = await getRepositoryName(projectPath);
  const generatedAt = new Date().toISOString();
  const aiAnalysis = await analyzeWithAi({
    repository,
    baseRef,
    headRef,
    changedFunctions,
    impactFunctions
  }, config);

  const report = {
    title: "Impact Analysis",
    repository,
    baseRef,
    headRef,
    generatedAt,
    diffText,
    changedFunctions,
    impactFunctions,
    aiAnalysis
  };
  const outputDir = resolve(projectPath, params.outputDir ?? config.outputDir);
  await mkdir(outputDir, { recursive: true });
  const { markdownFileName, htmlFileName } = buildReportFileNames(repository, headRef, generatedAt);
  const markdownPath = join(outputDir, markdownFileName);
  const htmlPath = join(outputDir, htmlFileName);
  await writeFile(markdownPath, renderMarkdownReport(report), "utf8");
  await writeFile(htmlPath, renderHtmlReport(report), "utf8");

  return {
    ...report,
    output: { markdownPath, htmlPath }
  };
}

function resolveRequiredPath(pathValue) {
  if (!pathValue) {
    throw new Error("Missing required parameter: path.");
  }
  return resolve(pathValue);
}
