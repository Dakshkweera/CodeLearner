import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import ReactFlow, {
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
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

// ─── Types ─────────────────────────────────────────────────────────────────────

type LayoutMode = '3d' | 'tree' | 'force';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const getNodeRole = (path: string): string => {
  const p = path.toLowerCase();
  if (p.match(/(^|\/)(index|server|main|app)\.(js|ts)x?$/)) return 'entry';
  if (p.includes('route') || p.includes('controller')) return 'route';
  if (p.includes('middleware')) return 'middleware';
  if (p.includes('util') || p.includes('helper') || p.includes('service')) return 'utility';
  return 'default';
};

const getNodeColor = (role: string, language: string): string => {
  if (role === 'entry') return '#10B981';
  if (role === 'route') return '#8B5CF6';
  if (role === 'middleware') return '#F59E0B';
  if (role === 'utility') return '#06B6D4';
  return language === 'typescript' ? '#3B82F6' : '#EAB308';
};

const getRoleIcon = (role: string) => {
  if (role === 'entry') return '⚡';
  if (role === 'route') return '🔀';
  if (role === 'middleware') return '🔧';
  if (role === 'utility') return '🛠';
  return '';
};

const getFolderFromPath = (path: string) =>
  path.includes('/') ? path.split('/').slice(0, -1).join('/') : 'root';

// ─── Hierarchical layout algorithm ─────────────────────────────────────────────

function computeHierarchicalPositions(
  nodes: any[],
  edges: any[],
): Map<string, { x: number; y: number }> {
  const out = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  nodes.forEach(n => { out.set(n.id, []); inDeg.set(n.id, 0); });
  edges.forEach(e => {
    if (out.has(e.source) && inDeg.has(e.target)) {
      out.get(e.source)!.push(e.target);
      inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
    }
  });

  const roots = nodes.filter(n => inDeg.get(n.id) === 0 || getNodeRole(n.path) === 'entry');
  const layers = new Map<string, number>();
  const queue: { id: string; layer: number }[] = [];
  (roots.length > 0 ? roots : [nodes[0]]).forEach(n => {
    layers.set(n.id, 0);
    queue.push({ id: n.id, layer: 0 });
  });

  while (queue.length > 0) {
    const { id, layer } = queue.shift()!;
    (out.get(id) || []).forEach(t => {
      if (!layers.has(t) || layers.get(t)! < layer + 1) {
        layers.set(t, layer + 1);
        queue.push({ id: t, layer: layer + 1 });
      }
    });
  }

  const maxLayer = Math.max(...Array.from(layers.values()), 0);
  nodes.forEach(n => { if (!layers.has(n.id)) layers.set(n.id, maxLayer + 1); });

  const byLayer = new Map<number, string[]>();
  layers.forEach((layer, id) => {
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(id);
  });

  const LAYER_H = 180;
  const NODE_W = 260;
  const positions = new Map<string, { x: number; y: number }>();
  byLayer.forEach((ids, layer) => {
    ids.forEach((id, i) => {
      positions.set(id, {
        x: (i - (ids.length - 1) / 2) * NODE_W,
        y: layer * LAYER_H,
      });
    });
  });

  return positions;
}

// ─── Custom ReactFlow Node ──────────────────────────────────────────────────────

const CustomNode = ({ data }: any) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(0,0,0,0.3)', borderRadius: 3, padding: '1px 4px', color: '#fff', flexShrink: 0 }}>
          {data.language === 'typescript' ? 'TS' : 'JS'}
        </span>
        {data.role !== 'default' && <span style={{ fontSize: 11 }}>{getRoleIcon(data.role)}</span>}
        <span style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.label}</span>
        {data.importance > 0 && (
          <span style={{ fontSize: 9, background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '1px 5px', color: '#fff', flexShrink: 0 }}>
            {data.importance}
          </span>
        )}
      </div>

      {hovered && (
        <div style={{
          position: 'absolute', bottom: '115%', left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', border: '1px solid #334155', borderRadius: 8,
          padding: '8px 10px', zIndex: 100, width: 220, pointerEvents: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        }}>
          <p style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{data.label}</p>
          <p style={{ color: '#64748B', fontSize: 10, marginBottom: 5, wordBreak: 'break-all' }}>{data.path}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #1E293B', paddingTop: 4 }}>
            <span style={{ color: '#94A3B8', fontSize: 10 }}>{data.language}</span>
            <span style={{ color: '#60A5FA', fontSize: 10 }}>↙ {data.importance} imports</span>
          </div>
        </div>
      )}

      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); data.onFocus(); }}
          style={{
            position: 'absolute', top: -10, right: -10, background: '#3B82F6',
            border: '2px solid #1D4ED8', borderRadius: '50%', width: 22, height: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 100, fontSize: 10, color: '#fff',
          }}
          title="Focus"
        >🎯</button>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

// ─── Folder Sidebar ─────────────────────────────────────────────────────────────
// Btn is a plain render function (not a component) to avoid the nested-component
// remount bug where React sees a new type every render and kills click handlers.

function folderBtn(
  label: string,
  count: number,
  id: string | null,
  activeFolder: string | null,
  onFolderClick: (f: string | null) => void,
  depth = 0,
) {
  const active = activeFolder === id;
  return (
    <button
      key={id ?? '__all__'}
      onClick={() => onFolderClick(id)}
      style={{
        width: '100%', textAlign: 'left', padding: `7px ${12 + depth * 8}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: active ? 'rgba(59,130,246,0.18)' : 'transparent',
        border: 'none', cursor: 'pointer',
        borderLeft: active ? '3px solid #3B82F6' : '3px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <span style={{
        color: active ? '#93C5FD' : '#94A3B8', fontSize: 11,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130,
      }}>
        {label}
      </span>
      <span style={{
        background: active ? '#1D4ED8' : '#1E293B',
        color: active ? '#BFDBFE' : '#64748B',
        fontSize: 10, borderRadius: 10, padding: '1px 6px', flexShrink: 0,
        fontWeight: active ? 700 : 400,
      }}>
        {count}
      </span>
    </button>
  );
}

const FolderSidebar = ({
  graphData, activeFolder, onFolderClick,
}: { graphData: any; activeFolder: string | null; onFolderClick: (f: string | null) => void }) => {
  if (!graphData) return null;

  // Count connected nodes per folder (same filter the graph uses)
  const connectedIds = new Set<string>();
  graphData.edges.forEach((e: any) => { connectedIds.add(e.source); connectedIds.add(e.target); });
  const connectedNodes = graphData.nodes.filter((n: any) => connectedIds.has(n.id));

  const folderMap = new Map<string, number>();
  connectedNodes.forEach((n: any) => {
    const f = getFolderFromPath(n.path);
    folderMap.set(f, (folderMap.get(f) || 0) + 1);
  });
  const folders = Array.from(folderMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const onlyOneFolder = folders.length <= 1;

  return (
    <div style={{ width: 195, flexShrink: 0, background: '#0A1628', borderRight: '1px solid #1E293B', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #1E293B', color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        📂 Folders
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {folderBtn('All files', connectedNodes.length, null, activeFolder, onFolderClick)}
        {onlyOneFolder && (
          <p style={{ color: '#334155', fontSize: 10, padding: '10px 12px', lineHeight: 1.5 }}>
            All files are in the root folder — no sub-folders to filter by.
          </p>
        )}
        {folders.map(([folder, count]) => {
          const name = folder === 'root' ? '/ root' : folder.split('/').pop() || folder;
          const icon = folder === 'root' ? '📁' : '  📂';
          const depth = folder === 'root' ? 0 : folder.split('/').length - 1;
          return folderBtn(`${icon} ${name}`, count, folder, activeFolder, onFolderClick, depth);
        })}
      </div>
      {activeFolder && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #1E293B' }}>
          <button
            onClick={() => onFolderClick(null)}
            style={{
              width: '100%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#F87171', borderRadius: 6, padding: '5px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}
          >✕ Clear filter</button>
        </div>
      )}
    </div>
  );
};

// ─── 3D Graph View ─────────────────────────────────────────────────────────────

const Graph3DView = ({
  graphData, folderFilter, searchTerm, onFileOpen,
}: { graphData: any; folderFilter: string | null; searchTerm: string; onFileOpen: (path: string, label: string, lang: string) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const fgRef = useRef<any>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const [frozen, setFrozen] = useState(false);
  const [settled, setSettled] = useState(false);
  const [navLocked, setNavLocked] = useState(true);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const didInitialFit = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    obs.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // Reset all state when data changes
  useEffect(() => {
    setSettled(false);
    setFrozen(false);
    setNavLocked(true);
    setFocusedNodeId(null);
    didInitialFit.current = false;
  }, [graphData, folderFilter]);

  // IDs of focused node + its direct neighbors
  const focusSet = useMemo(() => {
    if (!focusedNodeId || !graphData) return null;
    const s = new Set<string>([focusedNodeId]);
    graphData.edges.forEach((e: any) => {
      if (e.source === focusedNodeId) s.add(e.target);
      if (e.target === focusedNodeId) s.add(e.source);
    });
    return s;
  }, [focusedNodeId, graphData]);

  const gData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    const connectedIds = new Set<string>();
    graphData.edges.forEach((e: any) => { connectedIds.add(e.source); connectedIds.add(e.target); });

    let ns = graphData.nodes.filter((n: any) => connectedIds.has(n.id));
    if (folderFilter) ns = ns.filter((n: any) => getFolderFromPath(n.path) === folderFilter);
    const visibleIds = new Set(ns.map((n: any) => n.id));

    const imp = new Map<string, number>();
    graphData.edges.forEach((e: any) => imp.set(e.target, (imp.get(e.target) || 0) + 1));
    const searchLC = searchTerm.toLowerCase();

    return {
      nodes: ns.map((n: any) => {
        const role = getNodeRole(n.path);
        const importance = imp.get(n.id) || 0;
        const matchesSearch = searchTerm ? n.label.toLowerCase().includes(searchLC) : true;
        const inFocus = !focusSet || focusSet.has(n.id);
        return {
          id: n.id, name: n.label, path: n.path,
          language: n.language, role, importance,
          color: getNodeColor(role, n.language),
          val: Math.max(2, importance * 2 + 2),
          dimmed: !matchesSearch || !inFocus,
          isEntry: role === 'entry',
          isFocused: n.id === focusedNodeId,
        };
      }),
      links: graphData.edges
        .filter((e: any) => visibleIds.has(e.source) && visibleIds.has(e.target))
        .map((e: any) => ({ source: e.source, target: e.target })),
    };
  }, [graphData, folderFilter, searchTerm, focusSet, focusedNodeId]);

  // Apply strong repulsion forces so nodes spread out
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || gData.nodes.length === 0) return;
    const timer = setTimeout(() => {
      try {
        fg.d3Force('charge')?.strength(-500);
        fg.d3Force('link')?.distance(100).strength(0.15);
        fg.d3Force('center')?.strength(0.02);
        fg.d3ReheatSimulation();
      } catch (_) {}
    }, 80);
    return () => clearTimeout(timer);
  }, [gData]);

  // ── Camera controls ──────────────────────────────────────────────────────────

  const zoomCamera = useCallback((factor: number) => {
    const fg = fgRef.current;
    if (!fg) return;
    try {
      const pos = fg.camera().position;
      const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
      const scale = (dist * factor) / dist;
      fg.cameraPosition({ x: pos.x * scale, y: pos.y * scale, z: pos.z * scale }, undefined, 250);
    } catch (_) {}
  }, []);

  const fitAll = useCallback(() => {
    try { fgRef.current?.zoomToFit(400, 80); } catch (_) {}
  }, []);

  const toggleFreeze = useCallback(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (!frozen) {
      gData.nodes.forEach((node: any) => { node.fx = node.x; node.fy = node.y; node.fz = node.z; });
      setFrozen(true);
    } else {
      gData.nodes.forEach((node: any) => { delete node.fx; delete node.fy; delete node.fz; });
      fg.d3ReheatSimulation();
      setFrozen(false);
    }
  }, [frozen, gData]);

  // ── Click: first click = focus, second click on same node = open file ────────

  const handleNodeClick = useCallback((node: any) => {
    if (!node) return;
    if (focusedNodeId === node.id) {
      // Already focused — second click opens the file
      onFileOpen(node.path, node.name, node.language);
      setFocusedNodeId(null);
    } else {
      // First click on any node = enter focus mode
      setFocusedNodeId(node.id);
    }
  }, [focusedNodeId, onFileOpen]);

  // ── Node renderer ─────────────────────────────────────────────────────────────

  const nodeThreeObject = useCallback((node: any) => {
    const sprite = new SpriteText(node.name);
    if (node.dimmed) {
      sprite.color = '#1E293B';
      sprite.backgroundColor = '#0A162899';
      sprite.borderColor = '#1E293B';
      sprite.textHeight = 3;
    } else {
      sprite.color = '#ffffff';
      sprite.textHeight = node.isFocused ? node.val * 1.6 + 6 : node.val * 1.1 + 3;
      sprite.backgroundColor = node.color + (node.isFocused ? 'ee' : 'cc');
      sprite.borderColor = node.isFocused ? '#ffffff' : node.color;
      sprite.borderWidth = node.isFocused ? 3 : node.isEntry ? 2 : 0.8;
    }
    sprite.borderRadius = 4;
    sprite.padding = 2.5;
    return sprite;
  }, []);

  const handleEngineStop = useCallback(() => {
    setSettled(true);
    if (!didInitialFit.current) {
      didInitialFit.current = true;
      try { fgRef.current?.zoomToFit(600, 80); } catch (_) {}
    }
  }, []);

  // Focused node object (for the banner label)
  const focusedNode = focusedNodeId
    ? gData.nodes.find((n: any) => n.id === focusedNodeId) ?? null
    : null;

  return (
    <div
      ref={containerRef}
      onDoubleClick={() => setNavLocked(false)}
      style={{ width: '100%', height: '100%', position: 'relative', background: '#050A18', cursor: navLocked ? 'default' : 'grab' }}
    >
      {dims.w > 0 && (
        <ForceGraph3D
          key={folderFilter ?? '__all__'}
          ref={fgRef}
          graphData={gData}
          width={dims.w}
          height={dims.h}
          backgroundColor="#050A18"
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false}
          linkColor={(link: any) => {
            if (!focusSet) return 'rgba(96,165,250,0.22)';
            const s = typeof link.source === 'object' ? link.source.id : link.source;
            const t = typeof link.target === 'object' ? link.target.id : link.target;
            return focusSet.has(s) && focusSet.has(t) ? 'rgba(96,165,250,0.8)' : 'rgba(30,41,59,0.15)';
          }}
          linkWidth={(link: any) => {
            if (!focusSet) return 0.8;
            const s = typeof link.source === 'object' ? link.source.id : link.source;
            const t = typeof link.target === 'object' ? link.target.id : link.target;
            return focusSet.has(s) && focusSet.has(t) ? 2.5 : 0.3;
          }}
          linkDirectionalParticles={(link: any) => {
            if (!focusSet) return 1;
            const s = typeof link.source === 'object' ? link.source.id : link.source;
            const t = typeof link.target === 'object' ? link.target.id : link.target;
            return focusSet.has(s) && focusSet.has(t) ? 4 : 0;
          }}
          linkDirectionalParticleWidth={3}
          linkDirectionalParticleSpeed={0.006}
          linkDirectionalParticleColor={() => '#60A5FA'}
          warmupTicks={180}
          cooldownTicks={300}
          d3AlphaDecay={0.04}
          d3VelocityDecay={0.4}
          onNodeClick={handleNodeClick}
          onNodeHover={(node: any) => setHoveredNode(node || null)}
          onBackgroundClick={() => setFocusedNodeId(null)}
          onEngineStop={handleEngineStop}
          showNavInfo={false}
          enableNodeDrag={!navLocked}
          enableNavigationControls={!navLocked}
        />
      )}

      {/* ── Focus mode banner ── */}
      {focusedNode && (
        <div style={{
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: '#1E3A5F', border: '1px solid #3B82F6',
          borderRadius: 10, padding: '8px 16px', zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: focusedNode.color, boxShadow: `0 0 8px ${focusedNode.color}` }} />
          <span style={{ color: '#BFDBFE', fontSize: 12, fontWeight: 700 }}>
            🎯 {focusedNode.name}
          </span>
          <span style={{ color: '#60A5FA', fontSize: 11 }}>
            {(focusSet?.size ?? 1) - 1} connections
          </span>
          <div style={{ width: 1, height: 14, background: '#334155' }} />
          <button
            onClick={() => { onFileOpen(focusedNode.path, focusedNode.name, focusedNode.language); setFocusedNodeId(null); }}
            style={{ background: '#2563EB', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          >Open File →</button>
          <button
            onClick={() => setFocusedNodeId(null)}
            style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 14 }}
          >✕</button>
        </div>
      )}

      {/* ── Nav lock hint ── */}
      {navLocked && !focusedNode && (
        <div style={{
          position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,22,40,0.9)', border: '1px solid #334155',
          borderRadius: 20, padding: '6px 16px', zIndex: 15,
          display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ color: '#64748B', fontSize: 11 }}>
            Double-click to enable rotate / zoom · Click node to focus
          </span>
        </div>
      )}

      {/* ── Camera controls panel (right side) ── */}
      <div style={{
        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
        background: 'rgba(10,22,40,0.95)', border: '1px solid #1E293B',
        borderRadius: 10, overflow: 'hidden', backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', minWidth: 92,
        zIndex: 10,
      }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #1E293B', color: '#475569', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
          Camera
        </div>

        <button onClick={() => setNavLocked(v => !v)} style={{
          padding: '8px 10px', border: 'none', borderBottom: '1px solid #1E293B',
          background: navLocked ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          color: navLocked ? '#F87171' : '#4ADE80',
          cursor: 'pointer', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          {navLocked ? '🔒 Locked' : '🔓 Free'}
        </button>

        <button onClick={() => zoomCamera(0.65)} title="Zoom In" style={{
          padding: '9px', border: 'none', borderBottom: '1px solid #1E293B',
          background: 'transparent', color: '#E2E8F0', cursor: 'pointer',
          fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>🔍<span style={{ fontWeight: 700, fontSize: 16 }}>+</span></button>

        <button onClick={() => zoomCamera(1.5)} title="Zoom Out" style={{
          padding: '9px', border: 'none', borderBottom: '1px solid #1E293B',
          background: 'transparent', color: '#E2E8F0', cursor: 'pointer',
          fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>🔍<span style={{ fontWeight: 700, fontSize: 16 }}>−</span></button>

        <button onClick={fitAll} title="Fit all nodes in view" style={{
          padding: '9px', border: 'none', borderBottom: '1px solid #1E293B',
          background: 'transparent', color: '#60A5FA', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>⊡ Fit</button>

        {focusedNodeId && (
          <button onClick={() => setFocusedNodeId(null)} title="Exit focus mode" style={{
            padding: '9px', border: 'none', borderBottom: '1px solid #1E293B',
            background: 'rgba(59,130,246,0.2)', color: '#60A5FA',
            cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          }}>✕ Focus</button>
        )}

        <button onClick={toggleFreeze} title={frozen ? 'Unfreeze' : 'Freeze nodes'} style={{
          padding: '9px', border: 'none',
          background: frozen ? 'rgba(59,130,246,0.2)' : 'transparent',
          color: frozen ? '#60A5FA' : '#94A3B8',
          cursor: 'pointer', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontWeight: frozen ? 700 : 400,
        }}>
          {frozen ? '❄️ Fixed' : '📌 Fix'}
        </button>
      </div>

      {/* Settling indicator */}
      {!settled && (
        <div style={{
          position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,22,40,0.9)', border: '1px solid #1E293B',
          borderRadius: 20, padding: '4px 14px',
          color: '#475569', fontSize: 11,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
          Simulation settling…
        </div>
      )}

      {/* Hover card — only show when not focused or hovering a different node */}
      {hoveredNode && hoveredNode.id !== focusedNodeId && (
        <div style={{
          position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)',
          background: '#0F172A', border: `1px solid ${hoveredNode.color}88`,
          borderRadius: 10, padding: '10px 14px', pointerEvents: 'none',
          boxShadow: `0 0 30px ${hoveredNode.color}44`, minWidth: 220,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: hoveredNode.color, flexShrink: 0 }} />
            <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 13 }}>{hoveredNode.name}</span>
          </div>
          <p style={{ color: '#64748B', fontSize: 10, marginBottom: 4, wordBreak: 'break-all' }}>{hoveredNode.path}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ color: '#94A3B8', fontSize: 10 }}>{hoveredNode.language}</span>
            {hoveredNode.importance > 0 && <span style={{ color: '#60A5FA', fontSize: 10 }}>↙ {hoveredNode.importance} imports</span>}
            {hoveredNode.role !== 'default' && <span style={{ color: '#FCD34D', fontSize: 10 }}>{getRoleIcon(hoveredNode.role)} {hoveredNode.role}</span>}
          </div>
          <p style={{ color: '#475569', fontSize: 9, marginTop: 4 }}>
            {focusedNodeId ? 'Click to focus this node' : 'Click to focus · 2nd click opens file'}
          </p>
        </div>
      )}

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        background: 'rgba(10,22,40,0.85)', border: '1px solid #1E293B',
        borderRadius: 8, padding: '5px 10px', backdropFilter: 'blur(6px)',
      }}>
        <p style={{ color: '#475569', fontSize: 10 }}>
          {focusedNodeId ? '🎯 Click neighbors to refocus · Click background to exit · Open File button to view code' : 'Click node to focus · Double-click to rotate'}
        </p>
      </div>
    </div>
  );
};

// ─── 2D ReactFlow Graph View ────────────────────────────────────────────────────

const Graph2DView = ({
  graphData, folderFilter, searchTerm, layoutMode, onFileOpen,
}: {
  graphData: any; folderFilter: string | null; searchTerm: string;
  layoutMode: 'tree' | 'force'; onFileOpen: (path: string, label: string, lang: string) => void;
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    if (!graphData) { setNodes([]); setEdges([]); return; }

    const connectedIds = new Set<string>();
    graphData.edges.forEach((e: any) => { connectedIds.add(e.source); connectedIds.add(e.target); });

    let ns = graphData.nodes.filter((n: any) => connectedIds.has(n.id));
    if (folderFilter) ns = ns.filter((n: any) => getFolderFromPath(n.path) === folderFilter);
    const visibleIds = new Set(ns.map((n: any) => n.id));

    const imp = new Map<string, number>();
    graphData.edges.forEach((e: any) => imp.set(e.target, (imp.get(e.target) || 0) + 1));

    const searchLC = searchTerm.toLowerCase();
    const searchMatches = new Set<string>();
    if (searchTerm) ns.forEach((n: any) => { if (n.label.toLowerCase().includes(searchLC)) searchMatches.add(n.id); });

    const focusSet = new Set<string>();
    if (focusedId && visibleIds.has(focusedId)) {
      focusSet.add(focusedId);
      graphData.edges.forEach((e: any) => {
        if (e.source === focusedId) focusSet.add(e.target);
        if (e.target === focusedId) focusSet.add(e.source);
      });
    }

    // Compute positions
    let positions: Map<string, { x: number; y: number }>;
    if (layoutMode === 'tree') {
      positions = computeHierarchicalPositions(ns, graphData.edges);
    } else {
      positions = new Map();
      ns.forEach((n: any, i: number) => {
        const angle = (i / ns.length) * 2 * Math.PI;
        const r = Math.max(350, ns.length * 18);
        positions.set(n.id, { x: Math.cos(angle) * r + (Math.random() - 0.5) * 120, y: Math.sin(angle) * r + (Math.random() - 0.5) * 120 });
      });
      for (let iter = 0; iter < 220; iter++) {
        const forces = new Map<string, { x: number; y: number }>();
        ns.forEach((n: any) => forces.set(n.id, { x: 0, y: 0 }));
        ns.forEach((a: any) => {
          ns.forEach((b: any) => {
            if (a.id === b.id) return;
            const pa = positions.get(a.id)!, pb = positions.get(b.id)!;
            const dx = pa.x - pb.x, dy = pa.y - pb.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 32000 / (dist * dist);
            const fa = forces.get(a.id)!;
            forces.set(a.id, { x: fa.x + (dx / dist) * force, y: fa.y + (dy / dist) * force });
          });
        });
        graphData.edges.forEach((e: any) => {
          const ps = positions.get(e.source), pt = positions.get(e.target);
          if (!ps || !pt) return;
          const dx = pt.x - ps.x, dy = pt.y - ps.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = dist * 0.004;
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          const fs = forces.get(e.source), ft = forces.get(e.target);
          if (fs) forces.set(e.source, { x: fs.x + fx, y: fs.y + fy });
          if (ft) forces.set(e.target, { x: ft.x - fx, y: ft.y - fy });
        });
        ns.forEach((n: any) => {
          const p = positions.get(n.id)!, f = forces.get(n.id)!;
          positions.set(n.id, { x: p.x + f.x * 0.85, y: p.y + f.y * 0.85 });
        });
      }
    }

    const flowNodes: Node[] = ns.map((n: any) => {
      const importance = imp.get(n.id) || 0;
      const role = getNodeRole(n.path);
      const color = getNodeColor(role, n.language);
      const width = Math.min(Math.max(n.label.length * 8 + 90, 130), 260);

      let opacity = 1;
      let borderColor = 'rgba(255,255,255,0.12)';
      let borderWidth = 1.5;

      if (focusedId && visibleIds.has(focusedId)) {
        if (!focusSet.has(n.id)) { opacity = 0.06; }
        else if (n.id === focusedId) { borderColor = '#60A5FA'; borderWidth = 3; }
        else { borderColor = 'rgba(96,165,250,0.5)'; borderWidth = 2; }
      }

      if (searchTerm && searchMatches.size > 0) {
        opacity = searchMatches.has(n.id) ? 1 : Math.min(opacity, 0.1);
        if (searchMatches.has(n.id)) { borderColor = '#F97316'; borderWidth = 3; }
      }

      return {
        id: n.id, type: 'custom',
        data: { label: n.label, path: n.path, language: n.language, role, importance, onFocus: () => setFocusedId(n.id) },
        position: positions.get(n.id) || { x: 0, y: 0 },
        style: {
          background: color, color: '#fff',
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: 10, padding: '7px 10px', fontSize: 11, width,
          opacity, transition: 'opacity 0.2s, border 0.2s',
          boxShadow: n.id === focusedId ? `0 0 24px ${color}99` : '0 2px 10px rgba(0,0,0,0.5)',
          cursor: 'pointer',
        },
      };
    });

    const flowEdges: Edge[] = graphData.edges
      .filter((e: any) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e: any) => {
        const lit = !focusedId || (focusSet.has(e.source) && focusSet.has(e.target));
        return {
          id: e.id, source: e.source, target: e.target,
          type: 'smoothstep', animated: !!focusedId && lit,
          markerEnd: { type: 'arrowclosed', color: lit ? '#60A5FA' : '#1E293B', width: 14, height: 14 },
          style: { stroke: lit ? '#3B82F6' : '#1E293B', strokeWidth: lit ? 2 : 1, opacity: lit ? 0.65 : 0.12 },
        };
      });

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [graphData, searchTerm, focusedId, folderFilter, layoutMode, setNodes, setEdges]);

  const onNodeClick = useCallback(async (_: any, node: Node) => {
    onFileOpen(node.data.path, node.data.label, node.data.language);
  }, [onFileOpen]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {focusedId && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, background: '#1D4ED8', borderRadius: 8,
          padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(29,78,216,0.5)',
        }}>
          <span style={{ color: '#BFDBFE', fontSize: 12, fontWeight: 600 }}>🎯 Focus Mode</span>
          <button onClick={() => setFocusedId(null)}
            style={{ background: 'none', border: 'none', color: '#93C5FD', cursor: 'pointer', fontSize: 14 }}>
            ✕ Exit
          </button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        style={{ background: '#0A1628' }}
      >
        <Background color="#1E293B" gap={28} size={1} />
        <Controls style={{ background: '#1E293B', border: '1px solid #334155' }} />
        <MiniMap
          style={{ background: '#050A18', border: '1px solid #334155' }}
          nodeColor={(n) => (n.style?.background as string) || '#334155'}
          maskColor="rgba(0,0,0,0.7)"
        />
      </ReactFlow>
    </div>
  );
};

// ─── Main Panel ─────────────────────────────────────────────────────────────────

const GraphPanelContent = () => {
  const { graphData, setSelectedFile, setLoading, setError, graphFullscreen, setGraphFullscreen } = useAppStore();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('3d');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);

  const toggleFullscreen = useCallback(() => {
    const next = !graphFullscreen;
    setGraphFullscreen(next);
    if (next) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.();
    }
  }, [graphFullscreen, setGraphFullscreen]);

  // Sync state when user presses Esc to exit native fullscreen
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setGraphFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [setGraphFullscreen]);

  const handleFileOpen = useCallback(async (path: string, _label: string, _lang: string) => {
    const repo = useAppStore.getState().repository;
    if (!repo) return;
    try {
      setLoading({ loadingFile: true });
      setError(null);
      const { fileService } = await import('../../codeViewer');
      const fileData = await fileService.getFileContent(repo.owner, repo.name, path);
      setSelectedFile({
        path,
        content: fileData.content,
        language: fileService.detectLanguage(path),
      });
    } catch (err: any) {
      setError({ message: err.message, type: 'api' });
    } finally {
      setLoading({ loadingFile: false });
    }
  }, [setSelectedFile, setLoading, setError]);

  const handleExport = useCallback(async () => {
    const el = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!el) return;
    const url = await toPng(el, { backgroundColor: '#0A1628', quality: 1, pixelRatio: 3 });
    const a = document.createElement('a');
    a.download = `${useAppStore.getState().repository?.name || 'graph'}.png`;
    a.href = url;
    a.click();
  }, []);

  const stats = useMemo(() => {
    if (!graphData) return null;
    const connectedIds = new Set<string>();
    graphData.edges.forEach((e: any) => { connectedIds.add(e.source); connectedIds.add(e.target); });
    let ns = graphData.nodes.filter((n: any) => connectedIds.has(n.id));
    if (folderFilter) ns = ns.filter((n: any) => getFolderFromPath(n.path) === folderFilter);
    const folders = new Set(ns.map((n: any) => getFolderFromPath(n.path))).size;
    return { total: ns.length, edges: graphData.edges.length, folders };
  }, [graphData, folderFilter]);

  // Entry points for the learning guide
  const entryNodes = useMemo(() => {
    if (!graphData) return [];
    return graphData.nodes
      .filter((n: any) => getNodeRole(n.path) === 'entry')
      .slice(0, 3);
  }, [graphData]);

  const showGuide = !guideDismissed && !!graphData && (stats?.total ?? 0) > 15;

  if (!graphData) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050A18' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🗺️</div>
          <p style={{ color: '#94A3B8', fontSize: 16, marginBottom: 8 }}>No repository loaded</p>
          <p style={{ color: '#475569', fontSize: 13 }}>Paste a GitHub URL above and click Load</p>
        </div>
      </div>
    );
  }

  const modeButtons: { mode: LayoutMode; icon: string; label: string; tip: string }[] = [
    { mode: '3d', icon: '🌐', label: '3D', tip: 'Rotate in 3D space' },
    { mode: 'tree', icon: '📐', label: 'Tree', tip: 'Top-down dependency tree' },
    { mode: 'force', icon: '🔄', label: 'Force', tip: 'Physics force layout' },
  ];

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', flexDirection: 'column', background: '#050A18' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Sidebar toggle (collapsed) */}
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            zIndex: 20, background: '#1E293B', border: '1px solid #334155',
            borderLeft: 'none', borderRadius: '0 6px 6px 0',
            color: '#94A3B8', padding: '8px 5px', cursor: 'pointer', fontSize: 13,
          }}>›</button>
        )}

        {/* Folder sidebar */}
        {sidebarOpen && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <FolderSidebar
              graphData={graphData}
              activeFolder={folderFilter}
              onFolderClick={(f) => setFolderFilter(f)}
            />
            <button onClick={() => setSidebarOpen(false)} style={{
              position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)',
              zIndex: 20, background: '#1E293B', border: '1px solid #334155',
              borderRadius: '50%', width: 20, height: 20, color: '#94A3B8',
              cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>‹</button>
          </div>
        )}

        {/* Graph canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {/* Top toolbar */}
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 20, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {/* Search */}
            <div style={{
              background: 'rgba(10,22,40,0.92)', border: '1px solid #334155',
              borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
              backdropFilter: 'blur(10px)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}>
              <span style={{ color: '#475569', fontSize: 13 }}>🔍</span>
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', color: '#E2E8F0', width: 180, fontSize: 13 }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')}
                  style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 12 }}>✕</button>
              )}
            </div>

            {/* Layout toggle */}
            <div style={{
              display: 'flex', background: 'rgba(10,22,40,0.92)', border: '1px solid #334155',
              borderRadius: 8, overflow: 'hidden', backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}>
              {modeButtons.map(({ mode, icon, label, tip }, idx) => (
                <button
                  key={mode}
                  onClick={() => setLayoutMode(mode)}
                  title={tip}
                  style={{
                    padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: layoutMode === mode ? '#3B82F6' : 'transparent',
                    color: layoutMode === mode ? '#fff' : '#94A3B8',
                    transition: 'all 0.15s',
                    borderRight: idx < modeButtons.length - 1 ? '1px solid #334155' : 'none',
                  }}
                >{icon} {label}</button>
              ))}
            </div>

            {/* Export (2D only) */}
            {layoutMode !== '3d' && (
              <button onClick={handleExport} style={{
                background: 'rgba(22,101,52,0.9)', border: '1px solid #16A34A',
                color: '#fff', borderRadius: 8, padding: '6px 14px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                backdropFilter: 'blur(10px)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
              }}>↓ PNG</button>
            )}

            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              title={graphFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen — graph only'}
              style={{
                background: graphFullscreen ? 'rgba(239,68,68,0.15)' : 'rgba(10,22,40,0.92)',
                border: `1px solid ${graphFullscreen ? '#EF4444' : '#334155'}`,
                color: graphFullscreen ? '#FCA5A5' : '#94A3B8',
                borderRadius: 8, padding: '6px 12px',
                fontSize: 13, cursor: 'pointer',
                backdropFilter: 'blur(10px)', boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {graphFullscreen ? '⛶ Exit' : '⛶'}
            </button>
          </div>

          {/* Legend — collapsible */}
          {legendOpen ? (
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 20,
              background: 'rgba(10,22,40,0.94)', border: '1px solid #1E293B',
              borderRadius: 10, padding: '10px 12px', backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Legend</p>
                <button
                  onClick={() => setLegendOpen(false)}
                  title="Hide legend"
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 0 0 8px' }}
                >✕</button>
              </div>
              {[
                { color: '#10B981', label: '⚡ Entry' },
                { color: '#8B5CF6', label: '🔀 Routes' },
                { color: '#F59E0B', label: '🔧 Middleware' },
                { color: '#06B6D4', label: '🛠 Utilities' },
                { color: '#3B82F6', label: 'TypeScript' },
                { color: '#EAB308', label: 'JavaScript' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}88` }} />
                  <span style={{ color: '#CBD5E1', fontSize: 11 }}>{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setLegendOpen(true)}
              title="Show legend"
              style={{
                position: 'absolute', top: 12, right: 12, zIndex: 20,
                background: 'rgba(10,22,40,0.94)', border: '1px solid #1E293B',
                borderRadius: 8, padding: '5px 10px',
                color: '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                backdropFilter: 'blur(10px)', letterSpacing: '0.06em',
              }}
            >◉ Legend</button>
          )}

          {/* Learning Guide */}
          {showGuide && (
            <div style={{
              position: 'absolute', bottom: 50, left: 12, zIndex: 30,
              background: 'rgba(10,22,40,0.96)', border: '1px solid #1E3A5F',
              borderRadius: 12, padding: '14px 16px', maxWidth: 310,
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(59,130,246,0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <p style={{ color: '#60A5FA', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>📚 How to learn from this</p>
                  <p style={{ color: '#475569', fontSize: 10 }}>{stats?.total} files at once is overwhelming — here's a workflow:</p>
                </div>
                <button onClick={() => setGuideDismissed(true)}
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0, marginLeft: 8 }}>
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Step 1 */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 1 }}>1</div>
                  <div>
                    <p style={{ color: '#E2E8F0', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Start at an entry point ⚡</p>
                    <p style={{ color: '#64748B', fontSize: 11 }}>
                      {entryNodes.length > 0
                        ? `Click on ${entryNodes.map((n: any) => n.label).join(' or ')} — it's the app's starting file`
                        : 'Look for index.js / server.js / app.js — that\'s where the app starts'}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 1 }}>2</div>
                  <div>
                    <p style={{ color: '#E2E8F0', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Use Focus Mode 🎯</p>
                    <p style={{ color: '#64748B', fontSize: 11 }}>Hover a node → click the 🎯 button. You'll see only that file and its direct connections — no noise</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#065F46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0, marginTop: 1 }}>3</div>
                  <div>
                    <p style={{ color: '#E2E8F0', fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Read code + ask AI 💬</p>
                    <p style={{ color: '#64748B', fontSize: 11 }}>Click the node to open its code. Ask the AI "what does this file do?" or "explain this function"</p>
                  </div>
                </div>

                {/* Quick action */}
                <div style={{ borderTop: '1px solid #1E293B', paddingTop: 8, marginTop: 2 }}>
                  <p style={{ color: '#475569', fontSize: 10, marginBottom: 6 }}>💡 Tip: Switch to <strong style={{ color: '#94A3B8' }}>📐 Tree</strong> mode for a cleaner top-down view of dependencies</p>
                  <button
                    onClick={() => { setLayoutMode('tree'); setGuideDismissed(true); }}
                    style={{ background: '#1E3A5F', border: '1px solid #3B82F6', color: '#93C5FD', borderRadius: 6, padding: '5px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Switch to Tree view →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Graph */}
          {layoutMode === '3d' ? (
            <Graph3DView
              graphData={graphData}
              folderFilter={folderFilter}
              searchTerm={searchTerm}
              onFileOpen={handleFileOpen}
            />
          ) : (
            <Graph2DView
              graphData={graphData}
              folderFilter={folderFilter}
              searchTerm={searchTerm}
              layoutMode={layoutMode}
              onFileOpen={handleFileOpen}
            />
          )}
        </div>
      </div>

      {/* Bottom stats bar */}
      {stats && (
        <div style={{
          height: 34, background: '#0A1628', borderTop: '1px solid #1E293B',
          display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 24, flexShrink: 0,
        }}>
          <span style={{ color: '#475569', fontSize: 11 }}>
            <span style={{ color: '#60A5FA', fontWeight: 700 }}>{stats.total}</span> files
          </span>
          <span style={{ color: '#475569', fontSize: 11 }}>
            <span style={{ color: '#A78BFA', fontWeight: 700 }}>{stats.edges}</span> connections
          </span>
          <span style={{ color: '#475569', fontSize: 11 }}>
            <span style={{ color: '#34D399', fontWeight: 700 }}>{stats.folders}</span> folders
          </span>
          {folderFilter && (
            <span style={{ color: '#F59E0B', fontSize: 11 }}>
              📂 {folderFilter === 'root' ? '/' : folderFilter}
              <button onClick={() => setFolderFilter(null)}
                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', marginLeft: 6, fontSize: 11 }}>✕</button>
            </span>
          )}
          {searchTerm && <span style={{ color: '#F97316', fontSize: 11 }}>🔍 "{searchTerm}"</span>}
          <span style={{ color: '#334155', fontSize: 10, marginLeft: 'auto', paddingRight: 12 }}>
            {layoutMode === '3d' ? '🌐 3D Space' : layoutMode === 'tree' ? '📐 Dependency Tree' : '🔄 Force Layout'}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Export ─────────────────────────────────────────────────────────────────────

const GraphPanel = () => (
  <ReactFlowProvider>
    <GraphPanelContent />
  </ReactFlowProvider>
);

export default GraphPanel;
