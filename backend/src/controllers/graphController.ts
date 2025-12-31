import { Request, Response } from 'express';
import graphService from '../services/graphService';


export const getGraph = async (req: Request, res: Response) => {
  try {
    const { owner, name, folder } = req.query;


    if (!owner || !name) {
      return res.status(400).json({
        error: 'owner and name query parameters are required',
      });
    }

    // ✅ Convert query params to proper types
    const ownerStr = String(owner);
    const nameStr = String(name);
    const folderStr = folder ? String(folder) : undefined;

    console.log(`🏗️ Building graph for ${ownerStr}/${nameStr}${folderStr ? ` (folder: /${folderStr})` : ''}...`);
    
    // ✅ Pass folder to buildGraph
    const graph = await graphService.buildGraph(ownerStr, nameStr, folderStr);


    return res.status(200).json({
      owner: ownerStr,
      name: nameStr,
      folder: folderStr || null,
      graph,
      stats: {
        totalFiles: graph.nodes.length,
        totalImports: graph.edges.length,
        analyzedFolder: folderStr ? `/${folderStr}` : 'entire repository',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
