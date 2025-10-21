import { Request, Response } from 'express';
import repoService from '../services/repoService';
console.log('repoController loaded');

export const testCloneRepo = async (req: Request, res: Response) => {
  try {
    const { repoUrl } = req.body;

    if (!repoUrl) {
      return res.status(400).json({ error: 'repoUrl is required' });
    }

    if (!repoService.isValidGitHubUrl(repoUrl)) {
      return res.status(400).json({ error: 'Invalid GitHub URL' });
    }

    const result = await repoService.cloneRepo(repoUrl);

    if (result.success) {
      return res.status(200).json({
        message: 'Repository cloned successfully',
        data: result.repoInfo,
      });
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
