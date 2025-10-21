import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';
import { RepoInfo, CloneResult } from '../models';

console.log('Loading repoService...');
console.log('Temp repo path:', config.repo.tempPath);

class RepoService {
  private git: SimpleGit;
  private tempRepoPath: string;

  constructor() {
    this.git = simpleGit();
    this.tempRepoPath = config.repo.tempPath;
  }

  /**
   * Parse GitHub URL to extract owner and repo name
   */
  private parseGitHubUrl(url: string): { owner: string; name: string } | null {
    // Support formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    
    const httpsRegex = /github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/;
    const sshRegex = /git@github\.com:([^\/]+)\/([^\/\.]+)(\.git)?$/;
    
    let match = url.match(httpsRegex) || url.match(sshRegex);
    
    if (match) {
      return {
        owner: match[1],
        name: match[2],
      };
    }
    
    return null;
  }

  /**
   * Validate if the URL is a valid GitHub repository URL
   */
  public isValidGitHubUrl(url: string): boolean {
    return this.parseGitHubUrl(url) !== null;
  }

  /**
   * Clone a GitHub repository to local temp directory
   */
  public async cloneRepo(repoUrl: string): Promise<CloneResult> {
    try {
      // Validate URL
      const parsed = this.parseGitHubUrl(repoUrl);
      if (!parsed) {
        return {
          success: false,
          error: 'Invalid GitHub URL format',
        };
      }

      const { owner, name } = parsed;
      const localPath = path.join(this.tempRepoPath, owner, name);

      // Check if repo already exists
      const exists = await this.repoExists(localPath);
      if (exists) {
        console.log(`Repository already exists at: ${localPath}`);
        return {
          success: true,
          repoInfo: {
            owner,
            name,
            url: repoUrl,
            localPath,
            clonedAt: new Date(),
          },
        };
      }

      // Ensure temp directory exists
      await fs.mkdir(path.dirname(localPath), { recursive: true });

      // Clone the repository
      console.log(`Cloning repository: ${repoUrl}`);
      await this.git.clone(repoUrl, localPath);
      console.log(`Successfully cloned to: ${localPath}`);

      return {
        success: true,
        repoInfo: {
          owner,
          name,
          url: repoUrl,
          localPath,
          clonedAt: new Date(),
        },
      };
    } catch (error: any) {
      console.error('Error cloning repository:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if repository exists locally
   */
  private async repoExists(localPath: string): Promise<boolean> {
    try {
      await fs.access(localPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get local path for a repository
   */
  public getRepoPath(owner: string, name: string): string {
    return path.join(this.tempRepoPath, owner, name);
  }

  /**
   * Delete a cloned repository
   */
  public async deleteRepo(owner: string, name: string): Promise<boolean> {
    try {
      const localPath = this.getRepoPath(owner, name);
      await fs.rm(localPath, { recursive: true, force: true });
      console.log(`Deleted repository: ${localPath}`);
      return true;
    } catch (error: any) {
      console.error('Error deleting repository:', error.message);
      return false;
    }
  }

  /**
   * Clean up all repositories in temp directory
   */
  public async cleanupAll(): Promise<void> {
    try {
      await fs.rm(this.tempRepoPath, { recursive: true, force: true });
      await fs.mkdir(this.tempRepoPath, { recursive: true });
      console.log('Cleaned up all repositories');
    } catch (error: any) {
      console.error('Error cleaning up repositories:', error.message);
    }
  }
}

export default new RepoService();
