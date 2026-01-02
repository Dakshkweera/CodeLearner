import { CohereClient } from 'cohere-ai';
import { config } from '../config';

interface CodeChunk {
  filePath: string;
  functionName: string | null;
  codeSnippet: string;
  language: 'javascript' | 'typescript';
  startLine: number;
  endLine: number;
}

interface EmbeddingResult {
  filePath: string;
  functionName: string | null;
  codeSnippet: string;
  embedding: number[];
  metadata: {
    language: string;
    startLine: number;
    endLine: number;
    length: number;
  };
}

type EmbeddingProvider = 'cohere' | 'local';

class EmbeddingService {
  private cohere: CohereClient | null = null;
  private provider: EmbeddingProvider;

  constructor() {
    this.provider = (config.ai.embeddingProvider as EmbeddingProvider) || 'cohere';

    if (this.provider === 'cohere') {
      if (!config.ai.cohereApiKey) {
        throw new Error('COHERE_API_KEY is not set in environment variables');
      }

      this.cohere = new CohereClient({
        token: config.ai.cohereApiKey,
      });
      console.log('✅ Cohere embedding service initialized');
    } else {
      // local / open-source mode (Python / offline)
      this.cohere = null;
      console.log('✅ Embedding service in LOCAL mode (no Cohere calls)');
    }
  }

  /**
   * Handle Cohere API errors with specific messages
   */
  private handleCohereError(error: any): never {
    if (error.statusCode === 429 || error.message?.includes('rate limit')) {
      throw new Error(
        'Cohere API rate limit exceeded. Please try again later or reduce the number of chunks.'
      );
    }

    if (error.statusCode === 401 || error.statusCode === 403) {
      throw new Error('Invalid Cohere API key. Please check your configuration.');
    }

    if (error.statusCode === 400) {
      throw new Error(`Invalid request to Cohere API: ${error.message || 'Bad request'}`);
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error('Request to Cohere API timed out. Please try again.');
    }

    throw new Error(`Cohere API error: ${error.message || 'Unknown error'}`);
  }

  /**
   * Generate embeddings for multiple code chunks
   */
  async generateEmbeddings(chunks: CodeChunk[]): Promise<EmbeddingResult[]> {
    if (chunks.length === 0) {
      return [];
    }

    console.log(
      `🔄 Generating embeddings for ${chunks.length} code chunks using provider=${this.provider}...`
    );

    // Prepare texts
    const texts = chunks.map(chunk => {
      const prefix = chunk.functionName
        ? `File: ${chunk.filePath}\nFunction: ${chunk.functionName}\n\n`
        : `File: ${chunk.filePath}\n\n`;
      return prefix + chunk.codeSnippet;
    });

    // LOCAL mode: no online embedding here
    if (this.provider === 'local') {
      console.warn(
        '⚠️ EmbeddingService.generateEmbeddings called in LOCAL mode. ' +
          'This method should not be used for bulk embedding when using open-source embeddings.'
      );
      throw new Error(
        'Bulk embedding is disabled in LOCAL mode. Use the offline Python script to generate embeddings.'
      );
    }

    // COHERE mode
    try {
      if (!this.cohere) {
        throw new Error('Cohere client is not initialized');
      }

      const response = await this.cohere.embed({
        texts,
        model: 'embed-english-v3.0',
        inputType: 'search_document',
      });

      if (!response || !response.embeddings || !Array.isArray(response.embeddings)) {
        throw new Error('Invalid response from Cohere API');
      }

      if (response.embeddings.length !== chunks.length) {
        throw new Error(
          `Embedding count mismatch: expected ${chunks.length}, got ${response.embeddings.length}`
        );
      }

      const results: EmbeddingResult[] = chunks.map((chunk, index) => ({
        filePath: chunk.filePath,
        functionName: chunk.functionName,
        codeSnippet: chunk.codeSnippet,
        embedding: (response.embeddings as number[][])[index],
        metadata: {
          language: chunk.language,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          length: chunk.codeSnippet.length,
        },
      }));

      console.log(`✅ Generated ${results.length} embeddings successfully (Cohere)`);
      return results;
    } catch (error: any) {
      console.error('❌ Embedding generation failed:', error.message);

      if (error.message.includes('Cohere')) {
        throw error;
      }

      this.handleCohereError(error);
    }
  }

  /**
   * Generate embedding for a single query (for search)
   * – this can still use Cohere in production even if bulk embedding is offline.
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    if (!query || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    console.log(
      `🔍 Generating query embedding for: "${query.substring(0, 50)}..." using provider=${
        this.provider
      }`
    );

    if (this.provider === 'local') {
      // In LOCAL mode, you have two options:
      // 1) Also use Python for query embeddings (more work)
      // 2) Still call Cohere for queries only (cheaper than bulk)
      throw new Error(
        'Query embeddings in LOCAL mode are not implemented. ' +
          'Either switch EMBEDDING_PROVIDER=cohere or add a local query embedding path.'
      );
    }

    try {
      if (!this.cohere) {
        throw new Error('Cohere client is not initialized');
      }

      const response = await this.cohere.embed({
        texts: [query],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
      });

      if (!response || !response.embeddings || !Array.isArray(response.embeddings)) {
        throw new Error('Invalid response from Cohere API');
      }

      const embedding = (response.embeddings as number[][])[0];

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Empty embedding received from Cohere API');
      }

      console.log(`✅ Query embedding generated (dimension: ${embedding.length})`);
      return embedding;
    } catch (error: any) {
      console.error('❌ Query embedding failed:', error.message);

      if (error.message.includes('Cohere') || error.message.includes('Query')) {
        throw error;
      }

      this.handleCohereError(error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (this.provider === 'local') {
      console.log('ℹ️ Skipping Cohere connection test in LOCAL mode');
      return true;
    }

    try {
      if (!this.cohere) {
        throw new Error('Cohere client is not initialized');
      }

      await this.cohere.embed({
        texts: ['test'],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
      });
      console.log('✅ Cohere connection test successful');
      return true;
    } catch (error: any) {
      console.error('❌ Cohere connection test failed:', error.message);
      return false;
    }
  }
}

export default new EmbeddingService();
