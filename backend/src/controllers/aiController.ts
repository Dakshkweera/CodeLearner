import { Request, Response } from 'express';
import chatService from '../services/chatService';
// import fileService from '../services/fileService';

interface FileChatRequest {
  owner: string;
  name: string;
  path: string;
  question: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export const askFileQuestion = async (req: Request, res: Response) => {
  try {
    const { owner, name, path, question, history } = req.body as FileChatRequest;

    // Validate required fields
    if (!owner || !name || !path || !question) {
      return res.status(400).json({
        error: 'owner, name, path, and question are required',
      });
    }

    // Validate question
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

    console.log(`💬 [FILE AI] Question about ${owner}/${name}/${path}: "${question}"`);

    // Call chat service with file context
    const answer = await chatService.askAboutFile(
      owner,
      name,
      path,
      question,
      history || []
    );

    return res.status(200).json({
      answer,
    });
  } catch (error: any) {
    console.error('❌ [FILE AI] Error:', error.message);

    if (error.message.includes('File not found') || error.code === 'ENOENT') {
      return res.status(404).json({
        error: 'File not found',
        message: error.message,
      });
    }

    return res.status(500).json({
      error: error.message || 'Failed to process AI request',
    });
  }
};
