import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import TypeScript from 'tree-sitter-typescript';
import { ImportStatement } from '../models';

class ParseService {
  private jsParser: Parser;
  private tsParser: Parser;

  constructor() {
    // Initialize JavaScript parser
    this.jsParser = new Parser();
    this.jsParser.setLanguage(JavaScript);

    // Initialize TypeScript parser
    this.tsParser = new Parser();
    this.tsParser.setLanguage(TypeScript.typescript);

    console.log('ParseService initialized with JS/TS parsers');
  }

  /**
   * Detect if file is JS or TS based on extension
   */
  private getLanguage(filePath: string): 'javascript' | 'typescript' | null {
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      return 'javascript';
    }
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      return 'typescript';
    }
    return null;
  }

  /**
   * Parse file content and extract import statements
   */
  public parseImports(filePath: string, content: string): ImportStatement[] {
    const language = this.getLanguage(filePath);
    if (!language) {
      return []; // Skip non-JS/TS files
    }

    const parser = language === 'javascript' ? this.jsParser : this.tsParser;
    const tree = parser.parse(content);
    const imports: ImportStatement[] = [];

    // Traverse the syntax tree to find import statements
    const cursor = tree.walk();

    const visitNode = () => {
      const node = cursor.currentNode;

      // ES6 import: import { x } from 'module'
      if (node.type === 'import_statement') {
        const sourceNode = node.childForFieldName('source');
        if (sourceNode) {
          const importPath = sourceNode.text.replace(/['"]/g, ''); // Remove quotes
          imports.push({
            importedPath: importPath,
            line: node.startPosition.row + 1,
            type: 'import',
          });
        }
      }

      // CommonJS require: const x = require('module')
      if (node.type === 'call_expression') {
        const functionNode = node.childForFieldName('function');
        if (functionNode && functionNode.text === 'require') {
          const argsNode = node.childForFieldName('arguments');
          if (argsNode && argsNode.childCount > 0) {
            const firstArg = argsNode.child(1); // Skip opening paren
            if (firstArg && firstArg.type === 'string') {
              const importPath = firstArg.text.replace(/['"]/g, '');
              imports.push({
                importedPath: importPath,
                line: node.startPosition.row + 1,
                type: 'require',
              });
            }
          }
        }
      }

      // Dynamic import: import('module')
      if (node.type === 'call_expression') {
        const functionNode = node.childForFieldName('function');
        if (functionNode && functionNode.text === 'import') {
          const argsNode = node.childForFieldName('arguments');
          if (argsNode && argsNode.childCount > 0) {
            const firstArg = argsNode.child(1);
            if (firstArg && firstArg.type === 'string') {
              const importPath = firstArg.text.replace(/['"]/g, '');
              imports.push({
                importedPath: importPath,
                line: node.startPosition.row + 1,
                type: 'dynamic',
              });
            }
          }
        }
      }

      // Recursively visit children
      if (cursor.gotoFirstChild()) {
        do {
          visitNode();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };

    visitNode();
    return imports;
  }

  /**
   * Check if file should be parsed (JS/TS only)
   */
  public shouldParse(filePath: string): boolean {
    return this.getLanguage(filePath) !== null;
  }
}

export default new ParseService();
