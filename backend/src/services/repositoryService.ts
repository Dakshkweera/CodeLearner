import dbService from './dbService';
import repoService from './repoService';
import graphService from './graphService';
import chunkingService from './chunkingService';
import embeddingService from './embeddingService';
import fs from 'fs/promises';
import path from 'path';

// ✅ Configuration constants
const MAX_CHUNKS_PER_REPO = 30; // Limit to avoid rate limits
const ENABLE_RAG_PROCESS = process.env.ENABLE_RAG_PROCESS !== 'false'; // Default true for local dev

interface ProcessRepoResult {
  success: boolean;
  cached: boolean;
  repoId?: number;
  chunksCount?: number;
  error?: string;
  limited?: boolean; // Indicates if chunks were limited
}

class RepositoryService {
  /**
   * Check if RAG processing is enabled
   */
  private isProcessingEnabled(): boolean {
    return ENABLE_RAG_PROCESS;
  }

  /**
   * Process repository: Check cache or generate embeddings
   */
  async processRepository(
    owner: string,
    name: string,
    folder?: string,
  ): Promise<ProcessRepoResult> {
    const pool = dbService.getPool();

    try {
      // ✅ Check if processing is enabled (for production)
      if (!this.isProcessingEnabled()) {
        throw new Error(
          'RAG processing is disabled in production. Only pre-embedded demo repositories are available.',
        );
      }

      // Step 1: Check if repo already cached
      const cacheCheck = await pool.query(
        `SELECT id, access_count FROM repositories 
         WHERE owner = $1 AND name = $2 AND folder IS NOT DISTINCT FROM $3`,
        [owner, name, folder || null],
      );

      if (cacheCheck.rows.length > 0) {
        // ✅ CACHE HIT
        const repoId = cacheCheck.rows[0].id;

        // Update access stats
        await pool.query(
          `UPDATE repositories 
           SET last_accessed = NOW(), access_count = access_count + 1
           WHERE id = $1`,
          [repoId],
        );

        console.log(
          `✅ Cache HIT: ${owner}/${name}${folder ? `/${folder}` : ''}`,
        );

        // Get embeddings count
        const countResult = await pool.query(
          `SELECT COUNT(*) FROM code_embeddings WHERE repo_id = $1`,
          [repoId],
        );

        return {
          success: true,
          cached: true,
          repoId,
          chunksCount: parseInt(countResult.rows[0].count),
        };
      }

      // Step 2: CACHE MISS - Process repo
      console.log(`⏳ Cache MISS: Processing ${owner}/${name}...`);

      // Clone repo
      const cloneResult = await repoService.cloneRepo(
        `https://github.com/${owner}/${name}`,
        folder,
      );

      if (!cloneResult.success) {
        throw new Error(cloneResult.error || 'Failed to clone repository');
      }

      const repoPath = repoService.getRepoPath(owner, name);
      const analyzePath = folder ? path.join(repoPath, folder) : repoPath;
      void analyzePath; // not used yet, but harmless

      // Build graph and get all files
      const graph = await graphService.buildGraph(owner, name, folder);

      // Read file contents
      const filesWithContent = await Promise.all(
        graph.nodes.map(async node => {
          try {
            const fullPath = path.join(repoPath, node.path);
            const content = await fs.readFile(fullPath, 'utf-8');
            return {
              path: node.path,
              content,
              language: node.language as 'javascript' | 'typescript',
            };
          } catch (error: any) {
            console.error(`Error reading ${node.path}:`, error.message);
            return null;
          }
        }),
      );

      const validFiles = filesWithContent.filter(
        f => f !== null,
      ) as Array<{
        path: string;
        content: string;
        language: 'javascript' | 'typescript';
      }>;

      // Chunk files into functions
      let chunks = await chunkingService.chunkFiles(validFiles);
      console.log(`📦 Generated ${chunks.length} code chunks`);

      // ✅ LIMIT CHUNKS TO AVOID RATE LIMITS
      let wasLimited = false;
      if (chunks.length > MAX_CHUNKS_PER_REPO) {
        console.warn(
          `⚠️  Repository has ${chunks.length} chunks. Limiting to ${MAX_CHUNKS_PER_REPO} to avoid API rate limits.`,
        );
        chunks = chunks.slice(0, MAX_CHUNKS_PER_REPO);
        wasLimited = true;
      }

      // Generate embeddings with error handling
      let embeddings;
      try {
        embeddings = await embeddingService.generateEmbeddings(chunks);
        console.log(`🔢 Generated ${embeddings.length} embeddings`);
      } catch (error: any) {
        // Handle rate limit specifically
        if (error.message.includes('rate limit')) {
          throw new Error(
            'Cohere API rate limit exceeded. Please try again later or contact support for pre-embedded demo access.',
          );
        }
        throw error;
      }

      // Store in database
      const repoInsert = await pool.query(
        `INSERT INTO repositories (owner, name, folder) 
         VALUES ($1, $2, $3) RETURNING id`,
        [owner, name, folder || null],
      );
      const repoId = repoInsert.rows[0].id;

      // Batch insert embeddings with transaction
      await pool.query('BEGIN');

      try {
        for (const emb of embeddings) {
          await pool.query(
            `INSERT INTO code_embeddings 
             (repo_id, file_path, function_name, code_snippet, embedding, metadata)
             VALUES ($1, $2, $3, $4, $5::vector, $6)`,
            [
              repoId,
              emb.filePath,
              emb.functionName,
              emb.codeSnippet,
              JSON.stringify(emb.embedding),
              JSON.stringify(emb.metadata),
            ],
          );
        }

        await pool.query('COMMIT');
        console.log(
          `✅ Stored ${embeddings.length} embeddings in database`,
        );
      } catch (dbError) {
        await pool.query('ROLLBACK');
        throw dbError;
      }

      // Delete cloned repo to save space
      await repoService.deleteRepo(owner, name);
      console.log(`🗑️ Cleaned up local repository`);

      return {
        success: true,
        cached: false,
        repoId,
        chunksCount: embeddings.length,
        limited: wasLimited,
      };
    } catch (error: any) {
      console.error('❌ Repository processing failed:', error.message);

      // Cleanup on error
      try {
        await repoService.deleteRepo(owner, name);
      } catch {}

      return {
        success: false,
        cached: false,
        error: error.message,
      };
    }
  }

  /**
   * Get list of available demo repositories (pre-embedded)
   */
  async getDemoRepositories(): Promise<
    Array<{ owner: string; name: string; folder?: string }>
  > {
    const pool = dbService.getPool();

    try {
      const result = await pool.query(
        `SELECT DISTINCT owner, name, folder 
         FROM repositories 
         ORDER BY last_accessed DESC`,
      );

      return result.rows.map(row => ({
        owner: row.owner,
        name: row.name,
        folder: row.folder || undefined,
      }));
    } catch (error: any) {
      console.error('Error fetching demo repositories:', error);
      return [];
    }
  }

  /**
   * Check if a specific repository is available for RAG
   */
  async isRepositoryAvailable(
    owner: string,
    name: string,
    folder?: string,
  ): Promise<boolean> {
    const pool = dbService.getPool();

    try {
      const result = await pool.query(
        `SELECT id FROM repositories 
         WHERE owner = $1 AND name = $2 AND folder IS NOT DISTINCT FROM $3`,
        [owner, name, folder || null],
      );

      return result.rows.length > 0;
    } catch (error: any) {
      console.error('Error checking repository availability:', error);
      return false;
    }
  }

  /**
   * ✅ NEW: Check if a repository has precomputed embeddings (for ask-preembedded)
   * This is what your new route will call to decide if RAG is allowed.
   */
  async hasPreembeddedData(
    owner: string,
    name: string,
    folder?: string,
  ): Promise<boolean> {
    const pool = dbService.getPool();

    try {
      const params: any[] = [owner, name];
      let idx = 3;

      const folderFilter = folder ? `AND ce.folder IS NOT DISTINCT FROM $${idx++}` : '';
      if (folder) params.push(folder);

      const result = await pool.query(
        `
        SELECT COUNT(*)::int AS count
        FROM code_embeddings ce
        JOIN repositories r ON ce.repo_id = r.id
        WHERE r.owner = $1
          AND r.name = $2
          ${folderFilter}
          AND ce.embedding IS NOT NULL
        `,
        params,
      );

      return result.rows[0].count > 0;
    } catch (error: any) {
      console.error('Error checking preembedded data:', error.message);
      return false;
    }
  }

  /**
   * Process repository for LOCAL mode: only store chunks, no embeddings
   */
  async processRepositoryLocal(
    owner: string,
    name: string,
    folder?: string,
  ): Promise<ProcessRepoResult> {
    const pool = dbService.getPool();

    try {
      // 1) Check cache
      const cacheCheck = await pool.query(
        `SELECT id, access_count FROM repositories 
         WHERE owner = $1 AND name = $2 AND folder IS NOT DISTINCT FROM $3`,
        [owner, name, folder || null],
      );

      if (cacheCheck.rows.length > 0) {
        const repoId = cacheCheck.rows[0].id;

        await pool.query(
          `UPDATE repositories 
           SET last_accessed = NOW(), access_count = access_count + 1
           WHERE id = $1`,
          [repoId],
        );

        console.log(
          `✅ [LOCAL] Cache HIT: ${owner}/${name}${
            folder ? `/${folder}` : ''
          }`,
        );

        const countResult = await pool.query(
          `SELECT COUNT(*) FROM code_embeddings WHERE repo_id = $1`,
          [repoId],
        );

        return {
          success: true,
          cached: true,
          repoId,
          chunksCount: parseInt(countResult.rows[0].count, 10),
        };
      }

      // 2) CACHE MISS – clone & chunk
      console.log(`⏳ [LOCAL] Cache MISS: Processing ${owner}/${name}...`);

      const cloneResult = await repoService.cloneRepo(
        `https://github.com/${owner}/${name}`,
        folder,
      );

      if (!cloneResult.success) {
        throw new Error(cloneResult.error || 'Failed to clone repository');
      }

      const repoPath = repoService.getRepoPath(owner, name);
      const analyzePath = folder ? path.join(repoPath, folder) : repoPath;
      void analyzePath;

      const graph = await graphService.buildGraph(owner, name, folder);

      const filesWithContent = await Promise.all(
        graph.nodes.map(async node => {
          try {
            const fullPath = path.join(repoPath, node.path);
            const content = await fs.readFile(fullPath, 'utf-8');
            return {
              path: node.path,
              content,
              language: node.language as 'javascript' | 'typescript',
            };
          } catch (error: any) {
            console.error(`Error reading ${node.path}:`, error.message);
            return null;
          }
        }),
      );

      const validFiles = filesWithContent.filter(
        f => f !== null,
      ) as Array<{
        path: string;
        content: string;
        language: 'javascript' | 'typescript';
      }>;

      let chunks = await chunkingService.chunkFiles(validFiles);
      console.log(`📦 [LOCAL] Generated ${chunks.length} code chunks`);

      // 3) Limit chunks
      let wasLimited = false;
      if (chunks.length > MAX_CHUNKS_PER_REPO) {
        console.warn(
          `⚠️ [LOCAL] Repository has ${chunks.length} chunks. Limiting to ${MAX_CHUNKS_PER_REPO} to avoid issues.`,
        );
        chunks = chunks.slice(0, MAX_CHUNKS_PER_REPO);
        wasLimited = true;
      }

      // 4) Insert repo row
      const repoInsert = await pool.query(
        `INSERT INTO repositories (owner, name, folder) 
         VALUES ($1, $2, $3) RETURNING id`,
        [owner, name, folder || null],
      );
      const repoId = repoInsert.rows[0].id;

      // 5) Insert chunks in a transaction
      await pool.query('BEGIN');
      try {
        console.log(
          `💾 [LOCAL] Inserting ${chunks.length} chunks for repo_id=${repoId}...`,
        );

        for (const chunk of chunks) {
          await pool.query(
            `INSERT INTO code_embeddings 
             (repo_id, file_path, function_name, code_snippet, embedding, metadata)
             VALUES ($1, $2, $3, $4, NULL, $5)`,
            [
              repoId,
              chunk.filePath,
              chunk.functionName,
              chunk.codeSnippet,
              JSON.stringify({
                language: chunk.language,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                length: chunk.codeSnippet.length,
              }),
            ],
          );
        }

        await pool.query('COMMIT');
        console.log(
          `✅ [LOCAL] Stored ${chunks.length} code chunks without embeddings`,
        );
      } catch (dbError: any) {
        await pool.query('ROLLBACK');
        console.error(
          '❌ [LOCAL] Insert chunks failed:',
          dbError.message,
        );
        throw dbError;
      }

      // 6) Cleanup local clone
      try {
        await repoService.deleteRepo(owner, name);
        console.log(`🗑️ [LOCAL] Cleaned up local repository`);
      } catch (cleanupError: any) {
        console.warn(
          '⚠️ [LOCAL] Failed to clean up local repo:',
          cleanupError.message,
        );
      }

      return {
        success: true,
        cached: false,
        repoId,
        chunksCount: chunks.length,
        limited: wasLimited,
      };
    } catch (error: any) {
      console.error(
        '❌ [LOCAL] Repository processing failed:',
        error.message,
      );

      // Try cleanup but do not crash if it fails
      try {
        await repoService.deleteRepo(owner, name);
      } catch {}

      return {
        success: false,
        cached: false,
        error:
          error?.message || 'Unknown error in processRepositoryLocal',
      };
    }
  }
}

export default new RepositoryService();
