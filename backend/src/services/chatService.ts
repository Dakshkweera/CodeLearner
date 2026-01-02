import { config } from '../config';
import vectorSearchService from './vectorSearchService';
import fileService from './fileService';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  answer: string;
  relevantCode: Array<{
    filePath: string;
    functionName: string | null;
    similarity: number;
  }>;
}

class ChatService {
  private apiKey: string;
  private PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

  constructor() {
    this.apiKey = config.ai.perplexityApiKey;

    if (!this.apiKey) {
      console.warn('⚠️ PERPLEXITY_API_KEY not configured');
    }
  }
  /**
   * Answer question about repository using RAG (old flow)
   */
  async askQuestion(
    owner: string,
    name: string,
    folder: string | undefined,
    question: string,
    conversationHistory: Message[] = [],
  ): Promise<ChatResponse> {
    try {
      // Step 1: Find relevant code using vector search
      const relevantCode = await vectorSearchService.searchSimilarCode(
        owner,
        name,
        folder,
        question,
        5, // Top 5 chunks
      );

      if (relevantCode.length === 0) {
        return {
          answer:
            "I couldn't find any relevant code to answer your question. Please make sure the repository is loaded.",
          relevantCode: [],
        };
      }

      // Step 2: Build context from relevant code
      const codeContext = relevantCode
        .map((chunk, index) => {
          const funcName = chunk.functionName || 'Code block';
          return `### Code Chunk ${index + 1}: ${chunk.filePath} - ${funcName}\n\`\`\`${chunk.metadata.language}\n${chunk.codeSnippet}\n\`\`\``;
        })
        .join('\n\n');

      // Step 3: Build messages for Perplexity API
      const messages: Message[] = [
        {
          role: 'system',
          content: `You are a helpful code assistant for the repository ${owner}/${name}. 
Answer questions based ONLY on the provided code context. 
If the answer is not in the code, say "I don't have enough information in the provided code."
Provide clear explanations and reference specific files/functions when possible.`,
        },
        ...conversationHistory.slice(-5), // Last 5 messages for context
        {
          role: 'user',
          content: `Here is the relevant code from the repository:\n\n${codeContext}\n\nQuestion: ${question}`,
        },
      ];

      // Step 4: Call Perplexity API
      console.log('🤖 Calling Perplexity AI...');
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ai.perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',  // More comprehensive but slower          messages,
          temperature: 0.2, // Low temperature for more focused answers
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Perplexity API error: ${error}`);
      }

      const data = (await response.json()) as any;
      const answer: string = data.choices[0]?.message?.content ?? '';

      console.log('✅ Generated AI response');

      return {
        answer,
        relevantCode: relevantCode.map(chunk => ({
          filePath: chunk.filePath,
          functionName: chunk.functionName,
          similarity: chunk.similarity,
        })),
      };
    } catch (error: any) {
      console.error('❌ Chat service failed:', error.message);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }

  /**
   * ✅ NEW: Answer question when relevant code chunks are already selected (preembedded flow).
   */
  async answerFromPreembeddedChunks(
    owner: string,
    name: string,
    folder: string | undefined,
    question: string,
    relevantCode: Array<{
      filePath: string;
      functionName: string | null;
      codeSnippet: string;
      metadata: { language: string };
      similarity: number;
    }>,
    conversationHistory: Message[] = [],
  ): Promise<ChatResponse> {
    if (relevantCode.length === 0) {
      return {
        answer:
          "I couldn't find any relevant code to answer your question. Please make sure the repository is loaded.",
        relevantCode: [],
      };
    }

    const codeContext = relevantCode
      .map((chunk, index) => {
        const funcName = chunk.functionName || 'Code block';
        const language = chunk.metadata?.language || 'javascript';
        return `### Code Chunk ${index + 1}: ${chunk.filePath} - ${funcName}\n\`\`\`${language}\n${chunk.codeSnippet}\n\`\`\``;
      })
      .join('\n\n');

    const messages: Message[] = [
      {
        role: 'system',
        content: `You are a helpful code assistant for the repository ${owner}/${name}. 
Answer questions based ONLY on the provided code context. 
If the answer is not in the code, say "I don't have enough information in the provided code."
Provide clear explanations and reference specific files/functions when possible.`,
      },
      ...conversationHistory.slice(-5),
      {
        role: 'user',
        content: `Here is the relevant code from the repository:\n\n${codeContext}\n\nQuestion: ${question}`,
      },
    ];

    console.log('🤖 [PREEMBEDDED] Calling Perplexity AI...');
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ai.perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',  // More comprehensive but slower        messages,
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error: ${error}`);
    }

    const data = (await response.json()) as any;
    const answer: string = data.choices[0]?.message?.content ?? '';

    console.log('✅ [PREEMBEDDED] Generated AI response');

    return {
      answer,
      relevantCode: relevantCode.map(chunk => ({
        filePath: chunk.filePath,
        functionName: chunk.functionName,
        similarity: chunk.similarity,
      })),
    };
  }


   /**
 * Ask AI about a specific file
 */
/**
 * Ask AI about a specific file
 */
async askAboutFile(
  owner: string,
  name: string,
  filePath: string,
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  try {
    // Read the main file content
    const fileContent = await fileService.readFile(owner, name, filePath);

    // Try to read README for extra project context
    const readme = await fileService.readReadme(owner, name);

    // Build system prompt with code + optional README
    let systemContent = `You are a helpful AI assistant analyzing code files. Answer questions based on the provided code.

Repository: ${owner}/${name}
File: ${filePath}

Code:
\`\`\`
${fileContent}
\`\`\`
`;

    if (readme) {
      systemContent += `

Additional project context from README (use this to understand the overall project purpose, domain, and architecture):

${readme.substring(0, 3000)}

When answering high-level questions about "what this project is about", combine insights from both the README and the code above.`;
    }

    systemContent += `

**Response Format:**
- Use bullet points for organized answers
- Reference specific code with **[Line X]** or **[Lines X-Y]**
- For code examples, use markdown code blocks with language syntax
- Be concise but thorough
- Structure complex answers with sub-bullets when needed

Example format:
- **Main Point**: Description [Line 10]
  - Sub-point with detail
  - Another detail [Lines 15-20]
- **Another Point**: \`inline code\` example`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemContent },
    ];

    if (history && history.length > 0) {
      messages.push(...history.slice(-5));
    }

    messages.push({ role: 'user', content: question });

    const response = await fetch(this.PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages,
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data: any = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'No answer generated';
    return answer;
  } catch (error: any) {
    console.error('❌ [FILE AI] Service error:', error.message);
    throw error;
  }
}

}

export default new ChatService();
