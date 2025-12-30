import fs from 'fs/promises';
import path from 'path';
import parseService from './parseService';
import repoService from './repoService';
import { FileNode, FileEdge, FileGraph, ImportStatement } from '../models';

class GraphService {
  /**
   * Recursively find all JS/TS files in a directory
   */
  private async findJSTSFiles(
    dirPath: string,
    basePath: string
  ): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        // Skip node_modules, .git, dist, build folders
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === '.next' ||
          entry.name === 'coverage'
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findJSTSFiles(fullPath, basePath);
          files.push(...subFiles);
        } else if (entry.isFile() && parseService.shouldParse(entry.name)) {
          // Add JS/TS files
          files.push(relativePath);
        }
      }
    } catch (error: any) {
      console.error(`Error reading directory ${dirPath}:`, error.message);
    }

    return files;
  }

  /**
   * Resolve relative import path to actual file path
   */
  private resolveImportPath(
    importerPath: string,
    importedPath: string,
    allFiles: string[]
  ): string | null {
    // Skip external modules (npm packages)
    if (!importedPath.startsWith('.') && !importedPath.startsWith('/')) {
      return null; // External dependency
    }

    // Get directory of the importing file
    const importerDir = path.dirname(importerPath);
    
    // Resolve relative path
    let resolved = path.normalize(path.join(importerDir, importedPath));
    
    // Try different extensions if no extension provided
    const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.ts'];
    
    for (const ext of extensions) {
      const candidate = resolved + ext;
      const normalized = candidate.replace(/\\/g, '/'); // Normalize for comparison
      
      // Check if this file exists in our file list
      const found = allFiles.find(f => {
        const normalizedFile = f.replace(/\\/g, '/');
        return normalizedFile === normalized;
      });
      
      if (found) {
        return found;
      }
    }

    return null; // Could not resolve
  }

  /**
   * Build complete file dependency graph for a repository
   */
  public async buildGraph(owner: string, name: string): Promise<FileGraph> {
    console.log(`Building graph for ${owner}/${name}...`);
    
    const repoPath = repoService.getRepoPath(owner, name);
    
    // Step 1: Find all JS/TS files
    console.log('Finding all JS/TS files...');
    const allFiles = await this.findJSTSFiles(repoPath, repoPath);
    console.log(`Found ${allFiles.length} JS/TS files`);

    // Step 2: Create nodes for all files
    const nodes: FileNode[] = allFiles.map(filePath => ({
      id: filePath,
      path: filePath,
      label: path.basename(filePath),
      language: filePath.endsWith('.ts') || filePath.endsWith('.tsx') 
        ? 'typescript' 
        : 'javascript',
    }));

    // Step 3: Parse each file and build edges
    console.log('Parsing files and extracting imports...');
    const edges: FileEdge[] = [];
    let edgeIdCounter = 0;

    for (const filePath of allFiles) {
      try {
        const fullPath = path.join(repoPath, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        // Parse imports from this file
        const imports: ImportStatement[] = parseService.parseImports(
          filePath,
          content
        );

        // Create edges for each import
        for (const imp of imports) {
          const resolvedPath = this.resolveImportPath(
            filePath,
            imp.importedPath,
            allFiles
          );

          if (resolvedPath) {
            // Only add edge if we can resolve to a file in the repo
            edges.push({
              id: `edge-${edgeIdCounter++}`,
              source: filePath,
              target: resolvedPath,
              importType: imp.type,
            });
          }
        }
      } catch (error: any) {
        console.error(`Error parsing ${filePath}:`, error.message);
      }
    }

    console.log(`Built graph: ${nodes.length} nodes, ${edges.length} edges`);

    return { nodes, edges };
  }
}

export default new GraphService();
