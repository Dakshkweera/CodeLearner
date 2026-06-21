import { config } from '../config';
import fileService from './fileService';

class ChatService {
  private apiKey: string;
  private GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private MODEL = 'llama-3.3-70b-versatile';

  constructor() {
    this.apiKey = config.ai.groqApiKey;

    if (!this.apiKey) {
      console.warn('⚠️ GROQ_API_KEY not configured');
    }
  }

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

      const response = await fetch(this.GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.MODEL,
          messages,
          temperature: 0.2,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
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
