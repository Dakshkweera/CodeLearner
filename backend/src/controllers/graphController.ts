import { Request, Response } from 'express';
import graphService from '../services/graphService';

export const getGraph = async (req: Request, res: Response) => {
  try {
    const { owner, name } = req.query;

    if (!owner || !name) {
      return res.status(400).json({
        error: 'owner and name query parameters are required',
      });
    }

    console.log(`Building graph for ${owner}/${name}...`);
    const graph = await graphService.buildGraph(String(owner), String(name));

    return res.status(200).json({
      owner,
      name,
      graph,
      stats: {
        totalFiles: graph.nodes.length,
        totalImports: graph.edges.length,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
