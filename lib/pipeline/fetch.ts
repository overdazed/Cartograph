import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as tar from "tar";

const ARCHIVE_BYTE_CAP = 100 * 1024 * 1024;
const EXTRACTED_BYTE_CAP = 500 * 1024 * 1024;
const ENTRY_CAP = 100000;
const REQUEST_TIMEOUT_MS = 60000;

export type FetchedRepository = {
  rootPath: string;
  commitSha: string;
  cleanup: () => void;
};

/** Auto-generated docstring. */
function parseGitHubUrl(repositoryUrl: string): { owner: string; repo: string } {
  const cleaned = repositoryUrl.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/i);
  if (!match) throw new Error(`Not a GitHub repository URL: ${repositoryUrl}`);
  return { owner: match[1], repo: match[2] };
}

/** Auto-generated docstring. */
async function githubJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "cartograph", Accept: "application/vnd.github+json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`GitHub request failed (${response.status}): ${url}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Auto-generated docstring. */
export async function fetchRepository(repositoryUrl: string): Promise<FetchedRepository> {
  const { owner, repo } = parseGitHubUrl(repositoryUrl);

  /** Auto-generated docstring. */
  const repoInfo = (await githubJson(
    `https://api.github.com/repos/${owner}/${repo}`,
  )) as { default_branch?: string };
  if (!repoInfo.default_branch) {
    throw new Error(`Repository not found: ${repositoryUrl}`);
  }

  /** Auto-generated docstring. */
  const commitInfo = (await githubJson(
    `https://api.github.com/repos/${owner}/${repo}/commits/${repoInfo.default_branch}`,
  )) as { sha?: string };
  if (!commitInfo.sha) {
    throw new Error(`Could not resolve a commit for ${repositoryUrl}`);
  }
  const commitSha = commitInfo.sha;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartograph-"));
  const archivePath = path.join(tempDir, "repo.tar.gz");

  let cleanupDone = false;
  /** Auto-generated docstring. */
  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const archiveResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/tarball/${commitSha}`,
      {
        headers: { "User-Agent": "cartograph", Accept: "application/vnd.github+json" },
        redirect: "follow",
        signal: controller.signal,
      },
    );
    if (!archiveResponse.ok) {
      throw new Error(`Could not download archive (${archiveResponse.status})`);
    }

    const body = archiveResponse.body;
    if (!body) throw new Error("Archive response has no body");
    const reader = body.getReader();
    const fileStream = fs.createWriteStream(archivePath);
    let downloaded = 0;
    let downloadError: unknown = null;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        downloaded += value.byteLength;
        if (downloaded > ARCHIVE_BYTE_CAP) {
          throw new Error("Archive exceeds byte cap");
        }
        if (!fileStream.write(value)) {
          await new Promise<void>((resolve, reject) => {
            fileStream.once("drain", resolve);
            fileStream.once("error", reject);
          });
        }
      }
    } catch (error) {
      downloadError = error;
      await reader.cancel().catch(() => undefined);
    } finally {
      fileStream.end();
      await new Promise<void>((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
      }).catch((error) => {
        if (!downloadError) downloadError = error;
      });
    }
    if (downloadError) throw downloadError;

    let extractedBytes = 0;
    let entryCount = 0;
    await tar.x({
      file: archivePath,
      cwd: tempDir,
      strip: 1,
      onentry: (entry: { size?: number }) => {
        entryCount += 1;
        if (entryCount > ENTRY_CAP) throw new Error("Archive exceeds entry cap");
        extractedBytes += entry.size ?? 0;
        if (extractedBytes > EXTRACTED_BYTE_CAP) throw new Error("Extracted bytes exceed cap");
      },
    });

    fs.rmSync(archivePath, { force: true });

    clearTimeout(timer);
    return {
      rootPath: tempDir,
      commitSha,
      cleanup,
    };
  } catch (error) {
    clearTimeout(timer);
    cleanup();
    throw error;
  }
}
