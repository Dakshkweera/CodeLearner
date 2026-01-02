import { Request, Response } from 'express';
import repositoryService from '../services/repositoryService';
import chatService from '../services/chatService';
import repoService from '../services/repoService';
import vectorSearchService from '../services/vectorSearchService'; // ✅ new

/**
 * POST /api/rag/process
 * Process repository and generate embeddings
 */
export const processRepository = async (req: Request, res: Response) => {
  try {
    const { owner, name, folder } = req.body;

    // Validate required fields
    if (!owner || !name) {
      return res.status(400).json({
        error: 'owner and name are required',
      });
    }

    // ✅ Check if processing is enabled (production safeguard)
    const isEnabled = process.env.ENABLE_RAG_PROCESS !== 'false';

    if (!isEnabled) {
      return res.status(403).json({
        error: 'RAG processing is disabled in production',
        message:
          'Only pre-embedded demo repositories are available. Processing new repositories is disabled to manage API costs.',
        hint: 'Use /api/rag/demo-repos to see available repositories',
      });
    }

    console.log(
      `🔄 Processing repository: ${owner}/${name}${
        folder ? `/${folder}` : ''
      }`,
    );

    const result = await repositoryService.processRepository(
      owner,
      name,
      folder,
    );

    if (result.success) {
      const message = result.cached
        ? `Repository loaded from cache (${result.chunksCount} code chunks available)`
        : result.limited
        ? `Repository processed successfully (${result.chunksCount} code chunks generated, limited due to API constraints)`
        : `Repository processed successfully (${result.chunksCount} code chunks generated)`;

      return res.status(200).json({
        success: true,
        cached: result.cached,
        limited: result.limited || false,
        message,
        data: {
          repoId: result.repoId,
          chunksCount: result.chunksCount,
        },
      });
    } else {
      // Handle specific errors
      if (result.error?.includes('rate limit')) {
        return res.status(429).json({
          error: 'API rate limit exceeded',
          message: result.error,
          retryAfter: 3600, // Suggest retry after 1 hour
        });
      }

      return res.status(500).json({
        error: result.error || 'Failed to process repository',
      });
    }
  } catch (error: any) {
    console.error('❌ Process repository error:', error.message);

    // Handle specific error types
    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        error: 'API rate limit exceeded',
        message: error.message,
      });
    }

    if (error.message.includes('API key')) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Embedding service is not properly configured',
      });
    }

    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
};

/**
 * POST /api/rag/ask
 * Ask question about repository (old flow)
 */
export const askQuestion = async (req: Request, res: Response) => {
  try {
    const { owner, name, folder, question, conversationHistory } = req.body;

    // Validate required fields
    if (!owner || !name || !question) {
      return res.status(400).json({
        error: 'owner, name, and question are required',
      });
    }

    // Validate question length
    if (question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question cannot be empty',
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        error: 'Question is too long (max 1000 characters)',
      });
    }

    // ✅ Check if repository is available for querying
    const isAvailable = await repositoryService.isRepositoryAvailable(
      owner,
      name,
      folder,
    );

    if (!isAvailable) {
      return res.status(404).json({
        error: 'Repository not available',
        message: `The repository ${owner}/${name}${
          folder ? `/${folder}` : ''
        } has not been processed yet or is not available in the demo.`,
        hint: 'Use /api/rag/demo-repos to see available repositories',
      });
    }

    console.log(`💬 Question for ${owner}/${name}: "${question}"`);

    const result = await chatService.askQuestion(
      owner,
      name,
      folder,
      question,
      conversationHistory || [],
    );

    return res.status(200).json({
      success: true,
      answer: result.answer,
      relevantCode: result.relevantCode,
      repository: {
        owner,
        name,
        folder: folder || null,
      },
    });
  } catch (error: any) {
    console.error('❌ Ask question error:', error.message);

    // Handle specific error types
    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        error: 'API rate limit exceeded',
        message: 'Too many requests. Please try again later.',
      });
    }

    if (error.message.includes('No relevant code')) {
      return res.status(404).json({
        error: 'No relevant code found',
        message:
          'Could not find relevant code snippets for your question. Try rephrasing or asking about a different aspect of the codebase.',
      });
    }

    if (
      error.message.includes('API key') ||
      error.message.includes('Configuration')
    ) {
      return res.status(500).json({
        error: 'Service configuration error',
        message:
          'The AI service is not properly configured. Please contact support.',
      });
    }

    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
};

/**
 * ✅ NEW: POST /api/rag/ask-preembedded
 * Ask question using ONLY precomputed embeddings in Postgres.
 * - Does NOT trigger new embeddings.
 * - 404 if repo has no embeddings (cost control).
 */
export const askQuestionPreembedded = async (
  req: Request,
  res: Response,
) => {
  try {
    const { owner, name, folder, question, conversationHistory } = req.body;

    // Basic validation
    if (!owner || !name || !question) {
      return res.status(400).json({
        error: 'owner, name, and question are required',
      });
    }

    if (question.trim().length === 0) {
      return res.status(400).json({
        error: 'Question cannot be empty',
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        error: 'Question is too long (max 1000 characters)',
      });
    }

    // Only allow repos that already have embeddings in DB
    const hasEmbeddings = await repositoryService.hasPreembeddedData(
      owner,
      name,
      folder,
    );

    if (!hasEmbeddings) {
      return res.status(404).json({
        error: 'RAG not enabled for this repository',
        message: `The repository ${owner}/${name}${
          folder ? `/${folder}` : ''
        } does not have precomputed embeddings.`,
        hint: 'Only selected test/demo repositories have RAG enabled for cost reasons.',
      });
    }

    console.log(
      `💬 [PREEMBEDDED] Question for ${owner}/${name}: "${question}"`,
    );

    // Use new search that does NOT create embeddings
    const relevantCode =
      await vectorSearchService.searchUsingStoredEmbeddings(
        owner,
        name,
        folder,
        question,
        5,
      );

    if (relevantCode.length === 0) {
      return res.status(404).json({
        error: 'No relevant code found',
        message:
          'Could not find relevant code snippets for your question in the preembedded data. Try rephrasing or asking about a different part of the codebase.',
      });
    }

    const result = await chatService.answerFromPreembeddedChunks(
      owner,
      name,
      folder,
      question,
      relevantCode,
      conversationHistory || [],
    );

    return res.status(200).json({
      success: true,
      answer: result.answer,
      relevantCode: result.relevantCode,
      repository: {
        owner,
        name,
        folder: folder || null,
      },
    });
  } catch (error: any) {
    console.error('❌ [PREEMBEDDED] Ask question error:', error.message);

    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
};

/**
 * GET /api/rag/demo-repos
 * Get list of available demo repositories
 */
export const getDemoRepositories = async (req: Request, res: Response) => {
  try {
    const repos = await repositoryService.getDemoRepositories();

    return res.status(200).json({
      success: true,
      count: repos.length,
      repositories: repos,
      message:
        repos.length > 0
          ? 'Available demo repositories for RAG queries'
          : 'No repositories have been processed yet',
    });
  } catch (error: any) {
    console.error('❌ Get demo repos error:', error.message);
    return res.status(500).json({
      error: error.message || 'Failed to fetch demo repositories',
    });
  }
};

/**
 * POST /api/rag/process-local
 * Local mode: only store chunks, no online embeddings (for open-source pipeline)
 */
export const processRepositoryLocal = async (
  req: Request,
  res: Response,
) => {
  try {
    const { owner, name, folder } = req.body;

    if (!owner || !name) {
      return res.status(400).json({
        error: 'owner and name are required',
      });
    }

    console.log(
      `🔄 [LOCAL] Processing repository: ${owner}/${name}${
        folder ? `/${folder}` : ''
      }`,
    );

    const result = await repositoryService.processRepositoryLocal(
      owner,
      name,
      folder,
    );

    if (result.success) {
      return res.status(200).json({
        success: true,
        cached: result.cached,
        limited: result.limited || false,
        message: result.cached
          ? `Repository loaded from cache (${result.chunksCount} code chunks available, embeddings may already exist)`
          : `Repository processed in LOCAL mode (${result.chunksCount} code chunks stored without embeddings)`,
        data: {
          repoId: result.repoId,
          chunksCount: result.chunksCount,
        },
      });
    }

    return res.status(500).json({
      error: result.error || 'Failed to process repository in local mode',
    });
  } catch (error: any) {
    console.error('❌ [LOCAL] Process repository error:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
};
