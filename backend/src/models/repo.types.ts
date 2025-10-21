export interface RepoInfo {
  owner: string;
  name: string;
  url: string;
  localPath: string;
  clonedAt: Date;
}

export interface CloneResult {
  success: boolean;
  repoInfo?: RepoInfo;
  error?: string;
}
