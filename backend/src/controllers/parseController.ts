import { Request, Response } from 'express';
import parseService from '../services/parseService';
import fileService from '../services/fileService';

export const testParseFile = async (req: Request, res: Response) => {
  try {
    const { owner, name, path: filePath } = req.query;

    if (!owner || !name || !filePath) {
      return res.status(400).json({
        error: 'owner, name, and path query parameters are required',
      });
    }

    // Read file content
    const content = await fileService.readFile(
      String(owner),
      String(name),
      String(filePath)
    );

    // Parse imports
    const imports = parseService.parseImports(String(filePath), content);

    return res.status(200).json({
      file: filePath,
      language: filePath.toString().endsWith('.ts') ? 'typescript' : 'javascript',
      imports,
      importCount: imports.length,
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
};
