import { Request, Response } from 'express';
import fileService from '../services/fileService';

export const getFileContent = async (req: Request, res: Response) => {
  try {
    const { owner, name, path: filePath } = req.query;

    if (!owner || !name || !filePath) {
      return res.status(400).json({
        error: 'owner, name, and path query parameters are required',
      });
    }

    const content = await fileService.readFile(
      String(owner),
      String(name),
      String(filePath)
    );

    return res.status(200).json({
      owner,
      name,
      path: filePath,
      content,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }

    return res.status(400).json({ error: error.message || 'Failed to read file' });
  }
};
