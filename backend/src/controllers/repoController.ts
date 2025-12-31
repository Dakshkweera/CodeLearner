import { Request, Response } from 'express';
import repoService from '../services/repoService';
console.log('repoController loaded');


export const testCloneRepo = async (req: Request, res: Response) => {
  try {
    const { repoUrl, folder } = req.body; // ✅ Get both repoUrl and folder

    console.log('📦 Clone request:', { repoUrl, folder: folder || 'entire repo' });

    if (!repoUrl) {
      return res.status(400).json({ error: 'repoUrl is required' });
    }

    if (!repoService.isValidGitHubUrl(repoUrl)) {
      return res.status(400).json({ error: 'Invalid GitHub URL' });
    }

    // ✅ Pass folder to cloneRepo
    const result = await repoService.cloneRepo(repoUrl, folder);

    if (result.success) {
      return res.status(200).json({
        message: `Repository cloned successfully${folder ? ` (analyzing folder: /${folder})` : ''}`,
        data: {
          ...result.repoInfo,
          analyzedFolder: folder || null,
        },
      });
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
