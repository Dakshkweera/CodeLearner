// ============================================
// API Response Types (Match Backend)
// ============================================

export interface RepoInfo {
  owner: string;
  name: string;
  url: string;
  localPath: string;
  clonedAt: Date;
}

export interface CloneRepoResponse {
  success: boolean;
  repoInfo?: RepoInfo;
  error?: string;
}

export interface FileNode {
  id: string;
  path: string;
  label: string;
  language: 'javascript' | 'typescript' | 'unknown';
}

export interface FileEdge {
  id: string;
  source: string;
  target: string;
  importType: 'import' | 'require' | 'dynamic';
}


export interface FolderGroup {
  id: string;
  name: string;
  path: string;
  fileIds: string[];
}


export interface FileGraph {
  nodes: FileNode[];
  edges: FileEdge[];
  folderGroups?: FolderGroup[];
}


export interface GraphResponse {
  owner: string;
  name: string;
  graph: FileGraph;
  stats: {
    totalFiles: number;
    totalImports: number;
  };
}

export interface FileContentResponse {
  owner: string;
  name: string;
  path: string;
  content: string;
}

// ============================================
// Frontend State Types
// ============================================

export interface Repository {
  owner: string;
  name: string;
  url: string;
}

export interface SelectedFile {
  path: string;
  content: string;
  language: 'javascript' | 'typescript';
}

export interface LoadingState {
  cloning: boolean;
  loadingGraph: boolean;
  loadingFile: boolean;
}

export interface ErrorState {
  message: string;
  type: 'network' | 'validation' | 'api' | 'unknown';
}

// ============================================
// Utility Types
// ============================================

export type ApiError = {
  message: string;
  code?: string;
  status?: number;
};
