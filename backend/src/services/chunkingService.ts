import parseService from './parseService';

interface CodeChunk {
  filePath: string;
  functionName: string | null;
  codeSnippet: string;
  language: 'javascript' | 'typescript';
  startLine: number;
  endLine: number;
}

class ChunkingService {
  /**
   * Chunk a single file into smaller pieces
   * Strategy: Split by functions (using tree-sitter) or fixed size
   */
  public chunkFile(
    filePath: string,
    content: string,
    language: 'javascript' | 'typescript'
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    try {
      // Use tree-sitter to parse and extract functions
      const parser = language === 'javascript' 
        ? parseService['jsParser'] 
        : parseService['tsParser'];
      
      const tree = parser.parse(content);
      const lines = content.split('\n');

      // Walk the syntax tree and find function declarations
      const cursor = tree.walk();
      
      const extractFunctions = (node: any) => {
        // Function declarations and expressions
        if (
          node.type === 'function_declaration' ||
          node.type === 'arrow_function' ||
          node.type === 'method_definition' ||
          node.type === 'function_expression'
        ) {
          const startLine = node.startPosition.row;
          const endLine = node.endPosition.row;
          const functionCode = lines.slice(startLine, endLine + 1).join('\n');

          // Get function name if available
          let functionName = null;
          const nameNode = node.childForFieldName('name');
          if (nameNode) {
            functionName = nameNode.text;
          }

          chunks.push({
            filePath,
            functionName,
            codeSnippet: functionCode,
            language,
            startLine: startLine + 1,
            endLine: endLine + 1,
          });
        }

        // Recursively visit children
        if (cursor.gotoFirstChild()) {
          do {
            extractFunctions(cursor.currentNode);
          } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
      };

      extractFunctions(cursor.currentNode);

      // If no functions found, chunk entire file (fallback)
      if (chunks.length === 0) {
        chunks.push({
          filePath,
          functionName: null,
          codeSnippet: content,
          language,
          startLine: 1,
          endLine: lines.length,
        });
      }

      console.log(`📄 Chunked ${filePath}: ${chunks.length} chunks`);
      return chunks;

    } catch (error: any) {
      console.error(`❌ Error chunking ${filePath}:`, error.message);
      
      // Fallback: return entire file as one chunk
      return [{
        filePath,
        functionName: null,
        codeSnippet: content,
        language,
        startLine: 1,
        endLine: content.split('\n').length,
      }];
    }
  }

  /**
   * Chunk multiple files
   */
  public async chunkFiles(
    files: Array<{ path: string; content: string; language: 'javascript' | 'typescript' }>
  ): Promise<CodeChunk[]> {
    const allChunks: CodeChunk[] = [];

    for (const file of files) {
      const chunks = this.chunkFile(file.path, file.content, file.language);
      allChunks.push(...chunks);
    }

    console.log(`✅ Total chunks generated: ${allChunks.length}`);
    return allChunks;
  }
}

export default new ChunkingService();
