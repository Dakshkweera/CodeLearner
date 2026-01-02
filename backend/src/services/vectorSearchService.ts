import dbService from './dbService';
import embeddingService from './embeddingService';

interface SearchResult {
  filePath: string;
  functionName: string | null;
  codeSnippet: string;
  similarity: number;
  metadata: any;
}

class VectorSearchService {
  /**
   * Old flow – uses online query embeddings (Cohere) via embeddingService.
   * Used by /api/rag/ask
   */
  async searchSimilarCode(
    owner: string,
    name: string,
    folder: string | undefined,
    query: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    const pool = dbService.getPool();

    try {
      const repoResult = await pool.query(
        `SELECT id FROM repositories 
         WHERE owner = $1 AND name = $2 AND folder IS NOT DISTINCT FROM $3`,
        [owner, name, folder || null],
      );

      if (repoResult.rows.length === 0) {
        throw new Error(
          'Repository not found. Please load the repository first.',
        );
      }

      const repoId = repoResult.rows[0].id;

      console.log(`🔍 Searching for: "${query}"`);
      const queryEmbedding =
        await embeddingService.generateQueryEmbedding(query);

      const searchResult = await pool.query(
        `SELECT 
          file_path,
          function_name,
          code_snippet,
          metadata,
          1 - (embedding <=> $1::vector) AS similarity
         FROM code_embeddings
         WHERE repo_id = $2
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [JSON.stringify(queryEmbedding), repoId, limit],
      );

      const results: SearchResult[] = searchResult.rows.map(row => ({
        filePath: row.file_path,
        functionName: row.function_name,
        codeSnippet: row.code_snippet,
        similarity: parseFloat(row.similarity),
        metadata: row.metadata,
      }));

      console.log(`✅ Found ${results.length} relevant code chunks`);
      return results;
    } catch (error: any) {
      console.error('❌ Vector search failed:', error.message);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * ✅ NEW: Preembedded flow – NO Cohere, NO embeddingService.
   * Simple keyword search over code_snippet, but only among rows that have embeddings.
   */
  async searchUsingStoredEmbeddings(
    owner: string,
    name: string,
    folder: string | undefined,
    question: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const pool = dbService.getPool();

    try {
      // 1) Get repo ID
      const repoResult = await pool.query(
        `SELECT id FROM repositories 
         WHERE owner = $1 AND name = $2 AND folder IS NOT DISTINCT FROM $3`,
        [owner, name, folder || null],
      );

      if (repoResult.rows.length === 0) {
        throw new Error(
          'Repository not found. Please load the repository first.',
        );
      }

      const repoId = repoResult.rows[0].id;

      // 2) Build a loose keyword pattern from the question
      const terms = question
        .split(/\s+/)
        .filter(t => t.length > 3)
        .slice(0, 4); // up to 4 keywords

      const pattern =
        terms.length > 0 ? `%${terms.join('%')}%` : `%${question}%`;

      console.log(
        `🔎 [PREEMBEDDED] Text search with pattern "${pattern}" for repo_id=${repoId}`,
      );

      const searchResult = await pool.query(
        `
        SELECT
          file_path,
          function_name,
          code_snippet,
          metadata,
          1.0 AS similarity
        FROM code_embeddings
        WHERE repo_id = $1
          AND embedding IS NOT NULL
          AND code_snippet ILIKE $2
        LIMIT $3
        `,
        [repoId, pattern, limit],
      );

      const results: SearchResult[] = searchResult.rows.map(row => ({
        filePath: row.file_path,
        functionName: row.function_name,
        codeSnippet: row.code_snippet,
        similarity: parseFloat(row.similarity),
        metadata: row.metadata,
      }));

      console.log(
        `✅ [PREEMBEDDED] Found ${results.length} relevant code chunks`,
      );
      return results;
    } catch (error: any) {
      console.error(
        '❌ [PREEMBEDDED] Vector/text search failed:',
        error.message,
      );
      throw new Error(`Search failed: ${error.message}`);
    }
  }
}

export default new VectorSearchService();
