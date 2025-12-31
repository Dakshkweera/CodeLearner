import fs from 'fs/promises';
import path from 'path';
import parseService from './parseService';
import repoService from './repoService';
import { FileNode, FileEdge, FileGraph, ImportStatement } from '../models';


class GraphService {
  /**
   * Recursively find all JS/TS files in a directory
   * ✅ UPDATED: Now accepts optional folder parameter
   */
  private async findJSTSFiles(
    dirPath: string,
    basePath: string,
    folder?: string
  ): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });


      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        let relativePath = path.relative(basePath, fullPath);

        // ✅ FIXED: Don't prepend if already contains folder
        if (folder && !relativePath.startsWith(folder)) {
            relativePath = path.join(folder, relativePath);
        }



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
          const subFiles = await this.findJSTSFiles(fullPath, basePath, folder);
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
   * ✅ UPDATED: Now accepts optional folder parameter
   */
  public async buildGraph(owner: string, name: string, folder?: string): Promise<FileGraph> {
  console.log(`Building graph for ${owner}/${name}${folder ? ` (folder: /${folder})` : ''}...`);
  
  const repoPath = repoService.getRepoPath(owner, name);

  // ✅ FIXED: Separate analyze path and base path
  const analyzePath = folder ? path.join(repoPath, folder) : repoPath;
  const basePath = repoPath; // Always use repo root as base for relative paths

  // ✅ NEW: Check if folder exists
  if (folder) {
    try {
      await fs.access(analyzePath);
      console.log(`✅ Analyzing folder: /${folder}`);
    } catch {
      throw new Error(`Folder "${folder}" not found in repository`);
    }
  }
  
  // Step 1: Find all JS/TS files
  console.log('Finding all JS/TS files...');
  const allFiles = await this.findJSTSFiles(analyzePath, basePath, folder);
console.log(`Found ${allFiles.length} JS/TS files${folder ? ` in /${folder}` : ''}`);


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


    // STEP 4: Group nodes by folder
    const folderGroups = new Map<string, string[]>();
    
    allFiles.forEach(filePath => {
      const folder = filePath.includes('/') 
        ? filePath.substring(0, filePath.lastIndexOf('/'))
        : 'root';
      
      if (!folderGroups.has(folder)) {
        folderGroups.set(folder, []);
      }
      
      folderGroups.get(folder)!.push(filePath);
    });


    // Convert Map to array for JSON response
    const folderGroupsArray = Array.from(folderGroups.entries()).map(([path, fileIds]) => ({
      id: path,
      name: path.split('/').pop() || 'root',
      path: path,
      fileIds: fileIds
    }));


    return { 
      nodes, 
      edges,
      folderGroups: folderGroupsArray 
    };
  }
}


export default new GraphService();
