import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface GraphNode {
  id: string;
  name: string;
  x: number;
  y: number;
  isDragging: boolean;
  netBalance: number;
}

interface GraphEdge {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
}

export default function DebtGraph() {
  const { id: groupId } = useParams<{ id: string }>();
  const { activeGroup, fetchGroupDetail, optimizedSettlements, fetchOptimizedSettlements, loading } = useAppStore();

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragNodeIdRef = useRef<string | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const loadGraphData = useCallback(async (gId: string) => {
    await fetchGroupDetail(gId);
    await fetchOptimizedSettlements(gId);
  }, [fetchGroupDetail, fetchOptimizedSettlements]);

  useEffect(() => {
    if (groupId) {
      loadGraphData(groupId);
    }
  }, [groupId, loadGraphData]);

  // Construct nodes and edges once data is loaded
  useEffect(() => {
    if (!activeGroup || optimizedSettlements.length === 0) {
      // If activeGroup is loaded but there are no settlements, set nodes based on members
      if (activeGroup) {
        const initialNodes = activeGroup.members.map((m, idx) => {
          const angle = (idx / activeGroup.members.length) * 2 * Math.PI;
          const radius = 120;
          const centerX = 250;
          const centerY = 200;
          const bal = activeGroup.balances.find(b => b.userId === m.id)?.netBalance || 0;
          return {
            id: m.id,
            name: m.name,
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
            isDragging: false,
            netBalance: bal,
          };
        });
        setNodes(initialNodes);
        setEdges([]);
      }
      return;
    }

    const gEdges: GraphEdge[] = optimizedSettlements.map(tx => ({
      fromId: tx.from.id,
      fromName: tx.from.name,
      toId: tx.to.id,
      toName: tx.to.name,
      amount: tx.amount,
    }));

    // Generate circular layout coordinates for nodes
    const memberIds = activeGroup.members.map(m => m.id);
    const initialNodes = activeGroup.members.map((m, idx) => {
      const angle = (idx / memberIds.length) * 2 * Math.PI;
      const radius = 130;
      const centerX = 300;
      const centerY = 200;
      
      const balanceInfo = activeGroup.balances.find(b => b.userId === m.id);
      const netBalance = balanceInfo ? balanceInfo.netBalance : 0;

      return {
        id: m.id,
        name: m.name,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        isDragging: false,
        netBalance,
      };
    });

    setNodes(initialNodes);
    setEdges(gEdges);
  }, [activeGroup, optimizedSettlements]);

  // Drag and drop handlers
  const handleMouseDown = (e: React.MouseEvent<SVGCircleElement>, node: GraphNode) => {
    dragNodeIdRef.current = node.id;
    
    // Calculate offset inside the node circle
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const nodeCanvasX = clientX - rect.left;
      const nodeCanvasY = clientY - rect.top;
      offsetRef.current = {
        x: nodeCanvasX - node.x,
        y: nodeCanvasY - node.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragNodeIdRef.current || !svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Apply offset
    const newX = mouseX - offsetRef.current.x;
    const newY = mouseY - offsetRef.current.y;

    // Keep node inside boundaries
    const boundedX = Math.max(40, Math.min(rect.width - 40, newX));
    const boundedY = Math.max(40, Math.min(rect.height - 40, newY));

    setNodes(prev => prev.map(n => n.id === dragNodeIdRef.current ? { ...n, x: boundedX, y: boundedY } : n));
  };

  const handleMouseUp = () => {
    dragNodeIdRef.current = null;
  };

  if (loading && !activeGroup) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!activeGroup) {
    return (
      <div className="text-center py-12 glass-card max-w-md mx-auto">
        <h3 className="text-lg font-bold text-red-500">Group not found</h3>
        <p className="text-slate-500 mt-2">Cannot load debt visualizer.</p>
        <Link to="/groups" className="mt-6 inline-block text-brand-600 font-semibold hover:underline">Back</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link to={`/groups/${activeGroup.id}`} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400">
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {activeGroup.name} - Debt Visualizer
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive map of balances. Drag nodes around to organize.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* SVG Graph Canvas */}
        <div className="lg:col-span-3 glass-card p-4 relative overflow-hidden flex justify-center items-center bg-white/60 dark:bg-slate-900/40">
          <svg
            ref={svgRef}
            width="100%"
            height="420"
            viewBox="0 0 600 420"
            className="select-none cursor-default overflow-visible"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* SVG definitions for directed path arrows */}
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="28" // distance from destination node center to line endpoint arrow
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#ff6b6b" />
              </marker>
            </defs>

            {/* Grid background lines */}
            <g className="opacity-[0.03] dark:opacity-[0.02]">
              <path d="M 0,50 L 600,50 M 0,100 L 600,100 M 0,150 L 600,150 M 0,200 L 600,200 M 0,250 L 600,250 M 0,300 L 600,300 M 0,350 L 600,350 M 0,400 L 600,400" stroke="currentColor" strokeWidth="1" />
              <path d="M 50,0 L 50,420 M 100,0 L 100,420 M 150,0 L 150,420 M 200,0 L 200,420 M 250,0 L 250,420 M 300,0 L 300,420 M 350,0 L 350,420 M 400,0 L 400,420 M 450,0 L 450,420 M 50,0 L 500,420 M 550,0 L 550,420" stroke="currentColor" strokeWidth="1" />
            </g>

            {/* Edge paths connecting node entities */}
            {edges.map((edge, idx) => {
              const fromNode = nodes.find(n => n.id === edge.fromId);
              const toNode = nodes.find(n => n.id === edge.toId);

              if (!fromNode || !toNode) return null;

              // Calculate edge centers for labels
              const midX = (fromNode.x + toNode.x) / 2;
              const midY = (fromNode.y + toNode.y) / 2;

              return (
                <g key={idx}>
                  {/* Debt connection path */}
                  <line
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke="#ff6b6b"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                    markerEnd="url(#arrow)"
                    className="transition-all duration-75"
                  />
                  {/* Float amount box */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-32"
                      y="-11"
                      width="64"
                      height="20"
                      rx="6"
                      fill="#0f172a"
                      className="opacity-90 border dark:fill-slate-800"
                    />
                    <text
                      textAnchor="middle"
                      y="3"
                      fill="#ff6b6b"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      ₹{edge.amount}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Node circles */}
            {nodes.map(node => {
              const isDebtor = node.netBalance < 0;
              const formattedBal = Math.abs(node.netBalance);
              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`} className="cursor-pointer">
                  {/* Outer glow rings */}
                  <circle
                    r="26"
                    fill="transparent"
                    stroke={isDebtor ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}
                    strokeWidth="6"
                  />
                  {/* Interactive node dot */}
                  <circle
                    r="20"
                    fill={isDebtor ? '#fee2e2' : '#d1fae5'}
                    stroke={isDebtor ? '#f87171' : '#34d399'}
                    strokeWidth="2"
                    onMouseDown={(e) => handleMouseDown(e, node)}
                    className="transition-colors select-none"
                  />
                  {/* Capitalized initial letter */}
                  <text
                    textAnchor="middle"
                    y="5"
                    fill={isDebtor ? '#b91c1c' : '#065f46'}
                    fontSize="11"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    {node.name.slice(0, 3)}
                  </text>
                  
                  {/* Name label text floating below node */}
                  <text
                    textAnchor="middle"
                    y="36"
                    fill="currentColor"
                    fontSize="10"
                    fontWeight="bold"
                    className="text-slate-700 dark:text-slate-300"
                    pointerEvents="none"
                  >
                    {node.name}
                  </text>
                  
                  {/* Individual net balance marker tag */}
                  <text
                    textAnchor="middle"
                    y="47"
                    fill={isDebtor ? '#ef4444' : '#10b981'}
                    fontSize="8.5"
                    fontWeight="semibold"
                    pointerEvents="none"
                  >
                    {node.netBalance === 0 ? 'Settled' : `${isDebtor ? '-' : '+'}₹${formattedBal}`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Informative Side-panel */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 border-b pb-3 mb-4 dark:border-slate-800">
              Settlement Ledger
            </h3>
            
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This graph shows the **minimized debt flow** calculated dynamically to clear all balances using the minimum number of total payments.
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3.5 h-3.5 rounded bg-red-100 border border-red-400"></div>
                  <span className="text-slate-600 dark:text-slate-300">Owes money (Debtor)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3.5 h-3.5 rounded bg-green-100 border border-green-400"></div>
                  <span className="text-slate-600 dark:text-slate-300">Is owed money (Creditor)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t dark:border-slate-800 mt-6">
            <Link
              to={`/groups/${activeGroup.id}`}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all"
            >
              Back to Group Dashboard
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
