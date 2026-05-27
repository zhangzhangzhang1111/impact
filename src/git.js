import { runCommand } from "./process.js";

export async function getDiffText({ projectPath, branch, beforeCommit, afterCommit, remoteMaster }) {
  const base = beforeCommit || remoteMaster || "origin/master";
  const head = afterCommit || branch || "HEAD";
  const { stdout } = await runCommand("git", ["diff", "--unified=0", base, head], { cwd: projectPath });
  return { diffText: stdout, baseRef: base, headRef: head };
}

export async function getRepositoryName(projectPath) {
  try {
    const { stdout } = await runCommand("git", ["remote", "get-url", "origin"], { cwd: projectPath });
    return stdout.trim().split(/[\\/]/).pop()?.replace(/\.git$/, "") || projectPath;
  } catch {
    return projectPath;
  }
}
