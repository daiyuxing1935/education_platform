import { useCallback, useMemo, useEffect } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import dagre from '@dagrejs/dagre'
import 'reactflow/dist/style.css'
import type { PathNodeStatus, DagData } from '../api/path'
import { CheckCircleIcon, RefreshIcon, ClockIcon, FlagIcon, BookIcon, AlertTriangleIcon } from './Icons'

interface KnowledgeGraphProps {
  nodes: PathNodeStatus[]
  dagData?: DagData
  onNodeClick: (node: PathNodeStatus) => void
}

const STATUS_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  mastered: { border: 'var(--app-success)', bg: '#ECFDF5', text: 'var(--app-green-dark)' },
  learning: { border: 'var(--app-warning)', bg: '#FFFBEB', text: 'var(--app-amber-dark)' },
  reviewing: { border: 'var(--app-info)', bg: '#EFF6FF', text: 'var(--app-blue)' },
  not_started: { border: 'var(--app-text-placeholder)', bg: 'var(--app-bg-card-alt)', text: 'var(--app-text-secondary)' },
  in_progress: { border: 'var(--app-warning)', bg: '#FFFBEB', text: 'var(--app-amber-dark)' },
  completed: { border: 'var(--app-success)', bg: '#ECFDF5', text: 'var(--app-green-dark)' },
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  mastered: <CheckCircleIcon size={14} />,
  learning: <RefreshIcon size={14} className="icon-spin" />,
  in_progress: <RefreshIcon size={14} className="icon-spin" />,
  completed: <CheckCircleIcon size={14} />,
  not_started: <ClockIcon size={14} />,
  reviewing: <FlagIcon size={14} />,
}

function CustomNode({ data }: NodeProps) {
  const colors = STATUS_COLORS[data.status as string] || STATUS_COLORS.not_started
  const icon = STATUS_ICONS[data.status as string] || <ClockIcon size={14} />

  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: '12px',
      border: `2px solid ${colors.border}`,
      background: `linear-gradient(135deg, ${colors.bg}, white)`,
      minWidth: '160px',
      maxWidth: '200px',
      boxShadow: data.isDifficult
        ? '0 2px 8px rgba(239,68,68,0.15)'
        : '0 2px 8px rgba(0,0,0,0.04)',
      cursor: 'pointer',
      transition: 'box-shadow 0.2s, transform 0.2s',
      fontFamily: 'var(--font-body), system-ui, sans-serif',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: colors.border }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--app-text-heading)', lineHeight: 1.3 }}>
          {data.label}
        </span>
      </div>
      {data.masteryScore != null && data.masteryScore > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <div style={{
            flex: 1, height: '4px', background: 'var(--app-border)', borderRadius: '2px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${data.masteryScore}%`,
              background: colors.border,
              borderRadius: '2px',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: colors.text }}>
            {data.masteryScore}%
          </span>
        </div>
      )}
      {data.domain && (
        <div style={{ fontSize: '0.625rem', color: 'var(--app-text-muted)', marginTop: '4px' }}>
          <BookIcon size={10} /> {data.domain}
        </div>
      )}
      {data.isDifficult && (
        <span style={{
          display: 'inline-block', marginTop: '4px', padding: '1px 6px',
          background: '#FEE2E2', color: 'var(--app-danger-dark)', borderRadius: '4px',
          fontSize: '0.625rem', fontWeight: 600,
        }}>
          <AlertTriangleIcon size={10} /> 困难
        </span>
      )}
      <Handle type="source" position={Position.Right} style={{ background: colors.border }} />
    </div>
  )
}

const nodeTypes = { custom: CustomNode }

/**
 * dagre 自动布局 — 有向图从左到右排列
 */
function layoutWithDagre(
  dagNodes: { id: string; label: string; status: string; masteryScore: number; domain: string; isDifficult: boolean }[],
  dagEdges: { id: string; source: string; target: string; type: string; animated: boolean }[],
) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 120, marginx: 30, marginy: 30 })

  for (const n of dagNodes) {
    g.setNode(n.id, { width: 180, height: 80 })
  }
  for (const e of dagEdges) {
    g.setEdge(e.source, e.target)
  }
  dagre.layout(g)

  const flowNodes: Node[] = dagNodes.map((n) => {
    const pos = g.node(n.id)
    return {
      id: n.id,
      type: 'custom' as const,
      position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
      data: {
        label: n.label,
        status: n.status,
        masteryScore: n.masteryScore,
        domain: n.domain,
        isDifficult: n.isDifficult,
      },
    }
  })

  const flowEdges: Edge[] = dagEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'smoothstep',
    animated: e.type === 'PREREQUISITE',
    style: {
      stroke: e.type === 'PREREQUISITE' ? 'var(--app-brand)' : '#94a3b8',
      strokeWidth: e.type === 'PREREQUISITE' ? 2 : 1.5,
      strokeDasharray: e.type === 'RELATED_TO' ? '5,5' : 'none',
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: e.type === 'PREREQUISITE' ? 'var(--app-brand)' : '#94a3b8',
    },
    label: e.type === 'PREREQUISITE' ? '前置' : '关联',
    labelStyle: { fontSize: 10, fill: 'var(--app-text-secondary)' },
  }))

  return { flowNodes, flowEdges }
}

/**
 * 降级布局 — 当无 DAG 数据时，按领域分组排列（原逻辑）
 */
function layoutByDomain(pathNodes: PathNodeStatus[]): { flowNodes: Node[]; flowEdges: Edge[] } {
  const domainGroups = new Map<string, PathNodeStatus[]>()
  for (const n of pathNodes) {
    const key = n.domain_name || '未分类'
    if (!domainGroups.has(key)) domainGroups.set(key, [])
    domainGroups.get(key)!.push(n)
  }

  const flowNodes: Node[] = []
  const flowEdges: Edge[] = []
  const domainKeys = Array.from(domainGroups.keys())

  for (let di = 0; di < domainKeys.length; di++) {
    const domainName = domainKeys[di]
    const items = domainGroups.get(domainName)!
    const colX = di * 300

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const y = i * 130

      flowNodes.push({
        id: item.point_id,
        type: 'custom',
        position: { x: colX, y },
        data: {
          label: item.point_name,
          status: item.status || 'not_started',
          masteryScore: item.mastery_score,
          domain: item.domain_name,
          isDifficult: item.is_difficult,
          needsReview: item.needs_review,
        },
      })

      if (i > 0) {
        const prev = items[i - 1]
        flowEdges.push({
          id: `${prev.point_id}-${item.point_id}`,
          source: prev.point_id,
          target: item.point_id,
          style: { stroke: '#CBD5E1', strokeWidth: 1.5 },
          animated: false,
        })
      }
    }
  }

  return { flowNodes, flowEdges }
}

export default function KnowledgeGraph({ nodes, dagData, onNodeClick }: KnowledgeGraphProps) {
  const hasDagData = dagData?.nodes && dagData.nodes.length > 0

  const { flowNodes, flowEdges } = useMemo(() => {
    if (hasDagData && dagData) {
      return layoutWithDagre(
        dagData.nodes.map((n) => ({
          id: n.id,
          label: n.label,
          status: n.progress,
          masteryScore: n.mastery_score,
          domain: n.domain,
          isDifficult: n.is_weak,
        })),
        dagData.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          animated: e.animated,
        })),
      )
    }
    return layoutByDomain(nodes)
  }, [nodes, dagData])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(flowNodes)
  const [rfEdges] = useEdgesState(flowEdges)

  // Sync when data changes
  useEffect(() => {
    setRfNodes(flowNodes)
  }, [flowNodes])

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const pathNode = nodes.find(
        n => n.point_id === node.id || n.point_name === node.data?.label,
      )
      if (pathNode) onNodeClick(pathNode)
    },
    [nodes, onNodeClick],
  )

  const defaultViewport = useMemo(() => ({ x: 40, y: 40, zoom: 0.85 }), [])

  return (
    <div style={{ width: '100%', height: '100%', background: '#F8FAFC' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodesChange={onNodesChange}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="#E2E8F0" gap={24} />
        <Controls
          style={{
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        />
        <MiniMap
          style={{
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
          nodeColor={(n) => {
            const status = (n.data as any)?.status || 'not_started'
            return STATUS_COLORS[status]?.border || 'var(--app-text-placeholder)'
          }}
        />
      </ReactFlow>
    </div>
  )
}
