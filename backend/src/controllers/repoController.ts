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


// import { Request, Response } from 'express';
// import repoService from '../services/repoService';
// import graphService from '../services/graphService';

// console.log('repoController loaded');

// export const testCloneRepo = async (req: Request, res: Response) => {
//   try {
//     const { repoUrl, folder } = req.body;

//     console.log('📦 Clone request:', { repoUrl, folder: folder || 'entire repo' });

//     if (!repoUrl) {
//       return res.status(400).json({ error: 'repoUrl is required' });
//     }

//     if (!repoService.isValidGitHubUrl(repoUrl)) {
//       return res.status(400).json({ error: 'Invalid GitHub URL' });
//     }

//     // 1) Clone repo (includes folder validation logic you already have)
//     const result = await repoService.cloneRepo(repoUrl, folder);

//     if (!result.success || !result.repoInfo) {
//       return res.status(500).json({ error: result.error || 'Failed to clone repository' });
//     }

//     const { owner, name } = result.repoInfo;

//     try {
//       // 2) Build graph while repo exists on disk
//       const graph = await graphService.buildGraph(owner, name, folder);

//       // 3) DELETE cloned repo immediately after processing
//       await repoService.deleteRepo(owner, name);

//       // 4) Respond with processed data (no disk dependency)
//       return res.status(200).json({
//         message: `Repository cloned and processed successfully${
//           folder ? ` (analyzing folder: /${folder})` : ''
//         }`,
//         data: {
//           ...result.repoInfo,
//           analyzedFolder: folder || null,
//           graph,
//         },
//       });
//     } catch (processError: any) {
//       // Try cleanup even if processing fails
//       await repoService.deleteRepo(owner, name).catch(() => {});
//       console.error('❌ Processing error after clone:', processError.message);
//       return res.status(500).json({
//         error: processError.message || 'Failed to process repository',
//       });
//     }
//   } catch (error: any) {
//     console.error('❌ Clone controller error:', error.message);
//     return res.status(500).json({ error: error.message });
//   }
// };
