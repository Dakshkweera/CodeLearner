export interface FileNode {
  id: string;              // Unique identifier (file path)
  path: string;            // Relative path from repo root
  label: string;           // Display name (filename)
  language: 'javascript' | 'typescript' | 'unknown';
}

export interface FileEdge {
  id: string;              // Unique edge ID
  source: string;          // Source file path (who imports)
  target: string;          // Target file path (what is imported)
  importType: 'import' | 'require' | 'dynamic';
}

export interface FileGraph {
  nodes: FileNode[];
  edges: FileEdge[];
}

export interface ImportStatement {
  importedPath: string;    // Raw import path from code
  resolvedPath?: string;   // Resolved absolute path (if found)
  line: number;            // Line number in source
  type: 'import' | 'require' | 'dynamic';
}
