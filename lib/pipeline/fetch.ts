import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as tar from "tar";

export type FetchedRepository = {
  rootPath: string;
  commitSha: string;
  cleanup: () => void;
};

function parseGitHubUrl(repositoryUrl: string): { owner: string; repo: string } {
  const cleaned = repositoryUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/i);
  if (!match) throw new Error(`Not a GitHub repository URL: ${repositoryUrl}`);
  return { owner: match[1], repo: match[2] };
}

async function githubJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": "cartograph", Accept: "application/vnd.github+json" },
  });
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}): ${url}`);
  }
  return response.json();
}

export async function fetchRepository(repositoryUrl: string): Promise<FetchedRepository> {
  const { owner, repo } = parseGitHubUrl(repositoryUrl);

  const repoInfo = (await githubJson(
    `https://api.github.com/repos/${owner}/${repo}`,
  )) as { default_branch?: string };
  if (!repoInfo.default_branch) {
    throw new Error(`Repository not found: ${repositoryUrl}`);
  }

  const commitInfo = (await githubJson(
    `https://api.github.com/repos/${owner}/${repo}/commits/${repoInfo.default_branch}`,
  )) as { sha?: string };
  if (!commitInfo.sha) {
    throw new Error(`Could not resolve a commit for ${repositoryUrl}`);
  }
  const commitSha = commitInfo.sha;

  const archiveResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/tarball/${commitSha}`,
    {
      headers: { "User-Agent": "cartograph", Accept: "application/vnd.github+json" },
      redirect: "follow",
    },
  );
  if (!archiveResponse.ok) {
    throw new Error(`Could not download archive (${archiveResponse.status})`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-"));
  const archivePath = path.join(tempDir, "repo.tar.gz");
  const buffer = Buffer.from(await archiveResponse.arrayBuffer());
  fs.writeFileSync(archivePath, buffer);

  await tar.x({ file: archivePath, cwd: tempDir, strip: 1 });
  fs.rmSync(archivePath, { force: true });

  return {
    rootPath: tempDir,
    commitSha,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}
