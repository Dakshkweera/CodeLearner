
import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  type Node,
  type Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppStore } from '../../../shared/store/appStore';
import { toPng } from 'html-to-image';


// Custom Node Component with Focus Button and HANDLES
const CustomNode = ({ data }: any) => {
  const [isHovered, setIsHovered] = useState(false);


  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Connection Handles - REQUIRED for edges */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#555', opacity: 0 }}
      />
      
      {/* Node Label */}
      <div style={{ padding: '4px' }}>{data.label}</div>


      {/* Tooltip - appears on hover */}
      {isHovered && (
        <div className="absolute -top-28 left-1/2 transform -translate-x-1/2 bg-gray-900 border-2 border-gray-600 rounded-lg shadow-2xl px-3 py-2 z-50 w-64 pointer-events-none">
          <div className="text-xs space-y-1">
            <p className="text-white font-bold truncate">{data.label}</p>
            <p className="text-gray-400 text-[10px] truncate">📁 {data.path}</p>
            <div className="flex items-center justify-between pt-1 border-t border-gray-700">
              <span className="text-gray-300">🔤 {data.language}</span>
              <span className="text-blue-400">📥 {data.importance} imports</span>
            </div>
            <p className="text-yellow-300 text-[10px] capitalize">⭐ {data.role}</p>
            <p className="text-purple-400 text-[10px] truncate mt-1 pt-1 border-t border-gray-700">
              📂 Folder: {data.path.includes('/') ? data.path.substring(0, data.path.lastIndexOf('/')) : 'root'}
            </p>
          </div>
        </div>
      )}


      {/* Focus Button - appears on hover */}
      {isHovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onFocus();
          }}
          className="absolute -top-2 -right-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-lg transition-all z-50"
          title="Focus on this file"
        >
          🎯
        </button>
      )}


      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#555', opacity: 0 }}
      />
    </div>
  );
};


// Register custom node types
const nodeTypes = {
  custom: CustomNode,
};


const GraphPanelContent = () => {
  const { graphData, setSelectedFile, setLoading, setError } = useAppStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const { fitView } = useReactFlow();


  // Build and layout graph - ONLY runs when graphData/search/focus changes
  useEffect(() => {
    if (!graphData) {
      setNodes([]);
      setEdges([]);
      return;
    }


    // STEP 1: Filter out isolated nodes
    const connectedNodeIds = new Set<string>();
    graphData.edges.forEach((edge) => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });


    const connectedNodes = graphData.nodes.filter((node) =>
      connectedNodeIds.has(node.id)
    );


    // STEP 2: Calculate importance
    const importanceMap = new Map<string, number>();
    graphData.edges.forEach((edge) => {
      importanceMap.set(edge.target, (importanceMap.get(edge.target) || 0) + 1);
    });


    // STEP 3: Detect file role
    const getNodeRole = (path: string): string => {
      const lowerPath = path.toLowerCase();
      
      if (lowerPath.match(/^(index|server|main|app)\.(js|ts)$/)) {
        return 'entry';
      }
      if (lowerPath.includes('route') || lowerPath.includes('controller')) {
        return 'route';
      }
      if (lowerPath.includes('middleware')) {
        return 'middleware';
      }
      if (lowerPath.includes('util') || lowerPath.includes('helper')) {
        return 'utility';
      }
      return 'default';
    };


    // STEP 4: Get color
    const getNodeColor = (role: string, language: string): string => {
      if (role === 'entry') return '#10b981';
      if (role === 'route') return '#a78bfa';
      if (role === 'middleware') return '#f59e0b';
      if (role === 'utility') return '#06b6d4';
      return language === 'typescript' ? '#3178c6' : '#f9dc3e';
    };


    // STEP 5: Calculate node size based on filename length
    const getNodeSize = (filename: string, importance: number): number => {
      const charWidth = 8;
      const padding = 40;
      const filenameWidth = filename.length * charWidth + padding;
      const importanceBonus = Math.min(importance * 10, 40);
      return Math.min(Math.max(filenameWidth + importanceBonus, 140), 300);
    };


    // STEP 6: Find root nodes
    const rootNodes = connectedNodes.filter((node) => {
      const role = getNodeRole(node.path);
      const importsOthers = graphData.edges.some((e) => e.source === node.id);
      return role === 'entry' || !importsOthers;
    });


    if (rootNodes.length === 0 && connectedNodes.length > 0) {
      const maxImportance = Math.max(...Array.from(importanceMap.values()), 0);
      rootNodes.push(
        ...connectedNodes
          .filter((n) => (importanceMap.get(n.id) || 0) >= maxImportance)
          .slice(0, 3)
      );
    }


    // STEP 7: Assign levels using BFS
    const levels = new Map<string, number>();
    const processed = new Set<string>();
    const queue: Array<{ nodeId: string; level: number }> = [];


    rootNodes.forEach((node) => {
      queue.push({ nodeId: node.id, level: 0 });
      levels.set(node.id, 0);
    });


    while (queue.length > 0) {
      const { nodeId, level } = queue.shift()!;
      if (processed.has(nodeId)) continue;
      processed.add(nodeId);


      const children = graphData.edges
        .filter((e) => e.source === nodeId)
        .map((e) => e.target);


      children.forEach((childId) => {
        if (!levels.has(childId)) {
          levels.set(childId, level + 1);
          queue.push({ nodeId: childId, level: level + 1 });
        }
      });
    }


    connectedNodes.forEach((node) => {
      if (!levels.has(node.id)) {
        levels.set(node.id, 0);
      }
    });


    // STEP 8: Group nodes by level
    const nodesByLevel = new Map<number, string[]>();
    levels.forEach((level, nodeId) => {
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(nodeId);
    });


    // STEP 9: Focus Mode - visible nodes
    let visibleNodeIds = new Set(connectedNodes.map((n) => n.id));
    
    if (focusedNodeId) {
      visibleNodeIds = new Set([focusedNodeId]);
      
      graphData.edges
        .filter((e) => e.source === focusedNodeId)
        .forEach((e) => visibleNodeIds.add(e.target));
      
      graphData.edges
        .filter((e) => e.target === focusedNodeId)
        .forEach((e) => visibleNodeIds.add(e.source));
    }


    // STEP 10: Search matches
    const searchMatches = new Set<string>();
    if (searchTerm) {
      connectedNodes.forEach((node) => {
        if (node.label.toLowerCase().includes(searchTerm.toLowerCase())) {
          searchMatches.add(node.id);
        }
      });
    }


    // STEP 11: FORCE-DIRECTED WEB LAYOUT
const nodePositions = new Map<string, { x: number; y: number }>();

// Step 1: Initialize random positions for all nodes
connectedNodes.forEach((node, index) => {
  const angle = (index / connectedNodes.length) * 2 * Math.PI;
  const radius = 600;
  nodePositions.set(node.id, {
    x: Math.cos(angle) * radius + (Math.random() - 0.5) * 200,
    y: Math.sin(angle) * radius + (Math.random() - 0.5) * 200,
  });
});

// Step 2: Run force simulation (simplified)
const iterations = 180; // Number of simulation steps
const repulsionForce = 30000; // How much nodes push each other away
const attractionForce = 0.003; // How much connected nodes pull together
const damping = 0.85; // Friction/stabilization

for (let iter = 0; iter < iterations; iter++) {
  const forces = new Map<string, { x: number; y: number }>();
  
  // Initialize forces
  connectedNodes.forEach(node => {
    forces.set(node.id, { x: 0, y: 0 });
  });

  // Repulsion: All nodes push each other away
  connectedNodes.forEach(nodeA => {
    connectedNodes.forEach(nodeB => {
      if (nodeA.id === nodeB.id) return;
      
      const posA = nodePositions.get(nodeA.id)!;
      const posB = nodePositions.get(nodeB.id)!;
      
      const dx = posA.x - posB.x;
      const dy = posA.y - posB.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      
      const force = repulsionForce / (distance * distance);
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      
      const currentForce = forces.get(nodeA.id)!;
      forces.set(nodeA.id, {
        x: currentForce.x + fx,
        y: currentForce.y + fy,
      });
    });
  });

  // Attraction: Connected nodes pull each other closer
  graphData.edges.forEach(edge => {
    const posSource = nodePositions.get(edge.source);
    const posTarget = nodePositions.get(edge.target);
    
    if (!posSource || !posTarget) return;
    
    const dx = posTarget.x - posSource.x;
    const dy = posTarget.y - posSource.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    
    const force = distance * attractionForce;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    
    // Apply to source
    const forceSource = forces.get(edge.source)!;
    forces.set(edge.source, {
      x: forceSource.x + fx,
      y: forceSource.y + fy,
    });
    
    // Apply opposite to target
    const forceTarget = forces.get(edge.target)!;
    forces.set(edge.target, {
      x: forceTarget.x - fx,
      y: forceTarget.y - fy,
    });
  });

  // Update positions with damping
  connectedNodes.forEach(node => {
    const pos = nodePositions.get(node.id)!;
    const force = forces.get(node.id)!;
    
    nodePositions.set(node.id, {
      x: pos.x + force.x * damping,
      y: pos.y + force.y * damping,
    });
  });
}



    const flowNodes: Node[] = connectedNodes.map((node) => {
      const importance = importanceMap.get(node.id) || 0;
      const role = getNodeRole(node.path);
      const nodeWidth = getNodeSize(node.label, importance);
      const nodeColor = getNodeColor(role, node.language);


      const position = nodePositions.get(node.id) || { x: 0, y: 0 };


      let opacity = 1;
      let borderColor = '#555';
      let borderWidth = 2;


      if (focusedNodeId) {
        if (visibleNodeIds.has(node.id)) {
          opacity = 1;
          if (node.id === focusedNodeId) {
            borderColor = '#3b82f6';
            borderWidth = 4;
          }
        } else {
          opacity = 0.1;
        }
      }
      
      if (searchTerm && searchMatches.size > 0) {
        if (searchMatches.has(node.id)) {
          borderColor = '#ff6b35';
          borderWidth = 4;
        } else {
          opacity = 0.2;
        }
      }


      return {
        id: node.id,
        type: 'custom',
        data: {
          label: node.label,
          path: node.path,
          language: node.language,
          role,
          importance,
          onFocus: () => setFocusedNodeId(node.id),
        },
        position: position,
        style: {
          background: nodeColor,
          color: ['entry', 'route', 'middleware', 'utility'].includes(role) || node.language === 'typescript' ? '#fff' : '#000',
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: '8px',
          padding: '12px',
          fontSize: '11px',
          fontWeight: searchMatches.has(node.id) ? 700 : 500,
          width: nodeWidth,
          opacity,
          transition: 'all 0.3s ease',
        },
      };
    });



    // STEP 12: Create edges
    const flowEdges: Edge[] = graphData.edges
      .filter(
        (edge) =>
          connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target)
      )
      .map((edge) => {
        let strokeColor = '#888';
        let strokeWidth = 2;
        let opacity = 0.6;


        if (focusedNodeId) {
          const isConnected =
            visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
          
          if (isConnected) {
            strokeColor = '#60a5fa';
            strokeWidth = 3;
            opacity = 1;
          } else {
            opacity = 0.2;
          }
        }


        if (searchTerm && searchMatches.size > 0) {
          opacity = 0.3;
        }


        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          animated: focusedNodeId ? (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) : false,
          markerEnd: {
            type: 'arrowclosed',
            color: strokeColor,
            width: 20,
            height: 20,
          },
          style: {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: opacity,
          },
        };
      });


    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphData, setNodes, setEdges, searchTerm, focusedNodeId]);


  // Export handler with high quality
  const handleExport = useCallback(async () => {
    try {
      fitView({ padding: 0.1, duration: 200 });
      await new Promise(resolve => setTimeout(resolve, 400));
      
      const viewportElement = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!viewportElement) {
        alert('Graph element not found');
        return;
      }


      const dataUrl = await toPng(viewportElement, {
        backgroundColor: '#1f2937',
        quality: 1,
        pixelRatio: 4,
        cacheBust: true,
      });


      const link = document.createElement('a');
      const repo = useAppStore.getState().repository;
      link.download = `${repo?.name || 'graph'}-dependency-graph.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  }, [fitView]);


  // Handle SINGLE CLICK - View code
  const onNodeClick = useCallback(
    async (_event: any, node: Node) => {
      const filePath = node.data.path;
      const repo = useAppStore.getState().repository;


      if (!repo || !filePath) return;


      try {
        setLoading({ loadingFile: true });
        setError(null);


        const { fileService } = await import('../../codeViewer');
        const fileData = await fileService.getFileContent(
          repo.owner,
          repo.name,
          filePath
        );


        setSelectedFile({
          path: filePath,
          content: fileData.content,
          language: fileService.detectLanguage(filePath),
        });


        setLoading({ loadingFile: false });
      } catch (error: any) {
        setError({ message: error.message, type: 'api' });
        setLoading({ loadingFile: false });
      }
    },
    [setSelectedFile, setLoading, setError]
  );


  // Empty state
  if (!graphData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-800">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">No graph loaded</p>
          <p className="text-gray-500 text-sm">
            Enter a GitHub URL above to visualize dependencies
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="w-full h-full bg-gray-800 relative">
      {/* Search Bar & Export Button */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex items-center space-x-3">
        <div className="bg-gray-900 border-2 border-gray-700 rounded-lg shadow-lg px-4 py-2 flex items-center space-x-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-white outline-none w-64 placeholder-gray-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>


        {/* Export Button */}
        <button
          onClick={handleExport}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 transition-colors"
          title="Export full graph as high-quality PNG"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="text-sm font-semibold">Export</span>
        </button>
      </div>


      {/* Focus Mode Banner */}
      {focusedNodeId && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center space-x-3">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-semibold">Focus Mode Active</span>
            <button
              onClick={() => setFocusedNodeId(null)}
              className="ml-2 text-white hover:text-gray-200 font-bold text-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}


      {/* Legend */}
      <div className="absolute top-4 right-4 bg-gray-900 border-2 border-gray-700 rounded-lg shadow-lg px-4 py-3 z-10">
        <p className="text-white font-semibold text-xs mb-2">Legend</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-gray-300">Entry Point</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-purple-400"></div>
            <span className="text-gray-300">Routes</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-orange-500"></div>
            <span className="text-gray-300">Middleware</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-cyan-500"></div>
            <span className="text-gray-300">Utilities</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-yellow-400"></div>
            <span className="text-gray-300">JavaScript</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-yellow-400 font-bold mb-1">💡 Controls:</p>
          <p className="text-xs text-gray-300">• Click node = View code</p>
          <p className="text-xs text-gray-300">• Hover + click 🎯 = Focus</p>
          <p className="text-xs text-gray-300">• Hover = See folder path</p>
        </div>
      </div>


      {/* React Flow Graph */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#555" gap={16} />
        <Controls className="bg-gray-700 border border-gray-600" />
      </ReactFlow>
    </div>
  );
};


// Wrap with ReactFlowProvider to enable useReactFlow hook
const GraphPanel = () => {
  return (
    <ReactFlowProvider>
      <GraphPanelContent />
    </ReactFlowProvider>
  );
};


export default GraphPanel;
