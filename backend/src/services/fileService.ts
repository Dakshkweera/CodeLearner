import fs from 'fs/promises';
import path from 'path';
import repoService from './repoService';

export class FileService {
  /**
   * Safely read a file from a cloned repo
   * @param owner GitHub owner name
   * @param name  Repository name
   * @param relativeFilePath Path inside the repo (e.g. "src/index.ts")
   */
  public async readFile(
    owner: string,
    name: string,
    relativeFilePath: string
  ): Promise<string> {
    if (!relativeFilePath || relativeFilePath.trim() === '') {
      throw new Error('File path is required');
    }

    // Normalize and prevent path traversal (../../etc/passwd style attacks)
    const normalized = path.normalize(relativeFilePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const repoRoot = repoService.getRepoPath(owner, name);
    const fullPath = path.join(repoRoot, normalized);

    // Extra safety: ensure resolved path starts with repo root
    const resolvedRepoRoot = path.resolve(repoRoot);
    const resolvedFullPath = path.resolve(fullPath);
    if (!resolvedFullPath.startsWith(resolvedRepoRoot)) {
      throw new Error('Invalid file path');
    }

    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  }
}

const fileService = new FileService();
export default fileService;
