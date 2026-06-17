/**
 * KnowledgeGraphViz — 知识图谱可视化组件
 *
 * 使用领域分簇列式布局（Domain-Clustered Column Layout）：
 * - 每个领域（章节）为一列，节点纵向均匀分布 → 零重叠
 * - smoothstep 边路由 → 连线整洁不交叉
 * - 半透明细线 → 避免视觉杂乱
 */
import { useMemo } from 'react'
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
import 'reactflow/dist/style.css'
import type { GraphNode, GraphEdge } from '../api/knowledgeGraph'

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick?: (node: GraphNode) => void
}

/* ── 领域配色（按索引循环） ── */
const DOMAIN_COLORS = [
  { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },   // 蓝
  { bg: '#F0FDF4', border: '#22C55E', text: '#166534' },   // 绿
  { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },   // 金
  { bg: '#FDF2F8', border: '#EC4899', text: '#9D174D' },   // 粉
  { bg: '#EDE9FE', border: '#8B5CF6', text: '#5B21B6' },   // 紫
  { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B' },   // 红
  { bg: '#ECFDF5', border: '#14B8A6', text: '#115E59' },   // 青
  { bg: '#FFF7ED', border: '#F97316', text: '#9A3412' },   // 橙
  { bg: '#F0F9FF', border: '#0EA5E9', text: '#0C4A6E' },   // 天蓝
  { bg: '#FAF5FF', border: '#A855F7', text: '#6B21A8' },   // 紫罗兰
]

const NODE_HEIGHT = 66  // 每个节点占用高度（含间距）
const NODE_WIDTH = 120  // 节点宽度
const COL_GAP = 50      // 列间距

function getDomainIndex(domainId: string, domainIds: string[]) {
  const idx = domainIds.indexOf(domainId)
  return idx >= 0 ? idx % DOMAIN_COLORS.length : 0
}

/* ── 自定义节点 ── */
function CustomNode({ data }: NodeProps) {
  const colors = data.colors || DOMAIN_COLORS[0]

  return (
    <div
      style={{
        padding: '2px 5px',
        borderRadius: '5px',
        border: `1px solid ${colors.border}`,
        background: `linear-gradient(135deg, ${colors.bg}, white)`,
        width: NODE_WIDTH - 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        cursor: 'pointer',
        fontFamily: 'var(--font-body), system-ui, sans-serif',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 5, height: 5 }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '0.52rem',
          fontWeight: 600,
          color: '#1F2937',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          wordBreak: 'keep-all',
        }}>
          {data.label}
        </div>
        {data.domain && (
          <div style={{
            display: 'inline-block',
            marginTop: 1,
            padding: '0px 3px',
            borderRadius: 3,
            fontSize: '0.4rem',
            background: colors.bg,
            color: colors.text,
            fontWeight: 500,
            border: `1px solid ${colors.border}44`,
            maxWidth: 90,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {data.domain}
          </div>
        )}
        <div style={{ marginTop: 1, fontSize: '0.4rem', color: '#9CA3AF', lineHeight: 1 }}>
          {'★'.repeat(data.difficulty || 3)}{'☆'.repeat(5 - (data.difficulty || 3))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 5, height: 5 }} />
    </div>
  )
}

const nodeTypes = { custom: CustomNode }

/* ── 关系样式 ── */
const RELATION_STYLES: Record<string, { label: string; color: string; width: number; dash: string; opacity: number }> = {
  PREREQUISITE: { label: '前置', color: '#3B82F6', width: 1.5, dash: 'none', opacity: 0.5 },
  RELATED_TO:   { label: '关联', color: '#94A3B8', width: 1, dash: '5,4', opacity: 0.25 },
  CONTAINS:     { label: '包含', color: '#22C55E', width: 1, dash: 'none', opacity: 0.4 },
  APPLIES:      { label: '应用', color: '#F59E0B', width: 1, dash: 'none', opacity: 0.4 },
  DEPENDS_ON:   { label: '依赖', color: '#EF4444', width: 1, dash: 'none', opacity: 0.4 },
}

/* ═══════════════════════════════════════════
 * 领域分簇列式布局
 * ═══════════════════════════════════════════ */
function domainColumnLayout(
  graphNodes: GraphNode[],
  graphEdges: GraphEdge[],
) {
  // 1. 按 domain 分组（保持领域输入顺序）
  const domainOrder: string[] = []
  const domainMap = new Map<string, GraphNode[]>()
  for (const n of graphNodes) {
    if (!domainMap.has(n.domain_id)) {
      domainOrder.push(n.domain_id)
      domainMap.set(n.domain_id, [])
    }
    domainMap.get(n.domain_id)!.push(n)
  }

  // 2. 计算每列高度，确定画布尺寸
  let maxNodesInCol = 0
  for (const nodes of domainMap.values()) {
    if (nodes.length > maxNodesInCol) maxNodesInCol = nodes.length
  }

  const totalHeight = maxNodesInCol * NODE_HEIGHT + 80  // 上下留白
  const totalWidth = domainOrder.length * (NODE_WIDTH + COL_GAP) + 60

  // 3. 分配每个节点的坐标
  const posMap = new Map<string, { x: number; y: number }>()
  for (let di = 0; di < domainOrder.length; di++) {
    const did = domainOrder[di]
    const colNodes = domainMap.get(did) || []
    const colX = 30 + di * (NODE_WIDTH + COL_GAP) + NODE_WIDTH / 2

    // 列内节点均匀分布，居中对齐
    const colHeight = colNodes.length * NODE_HEIGHT
    const startY = (totalHeight - colHeight) / 2 + NODE_HEIGHT / 2

    for (let ni = 0; ni < colNodes.length; ni++) {
      posMap.set(colNodes[ni].id, {
        x: colX,
        y: startY + ni * NODE_HEIGHT,
      })
    }
  }

  // 4. 优化：同领域节点间微调垂直位置，以减少边交叉
  //    同一领域内，如果 A→B 有边，尽量让 B 在 A 正下方
  //    构建领域内边导向：计算每个节点的"理想垂直位置"偏移
  for (let di = 0; di < domainOrder.length; di++) {
    const did = domainOrder[di]
    const colNodes = domainMap.get(did) || []
    if (colNodes.length <= 2) continue

    // 计算领域内边吸引偏移
    const idSet = new Set(colNodes.map(n => n.id))
    const localEdges = graphEdges.filter(
      e => idSet.has(e.source) && idSet.has(e.target),
    )

    // 对于每条领域内边，如果 source 在当前在 target 下方，交换它们的 y
    // （只交换一次，不链式传播以避免过度调整）
    for (const e of localEdges) {
      const sPos = posMap.get(e.source)
      const tPos = posMap.get(e.target)
      if (!sPos || !tPos) continue

      // 如果 source 在 target 下方（不应该），交换 y
      if (sPos.y > tPos.y) {
        const temp = sPos.y
        sPos.y = tPos.y
        tPos.y = temp
      }
    }
  }

  /* ── 领域标头 Y 坐标 ── */
  const domainHeaderY: Record<string, number> = {}
  for (const [did, nodes] of domainMap) {
    const positions = nodes.map(n => posMap.get(n.id)?.y ?? 0)
    const minY = Math.min(...positions)
    const maxY = Math.max(...positions)
    domainHeaderY[did] = minY - NODE_HEIGHT / 2 - 4
  }

  // 5. 构建 ReactFlow 节点
  const domainIds = Array.from(new Set(graphNodes.map(n => n.domain_id)))
  const flowNodes: Node[] = []

  // 领域标头节点（透明，用于显示领域名称）
  for (let di = 0; di < domainOrder.length; di++) {
    const did = domainOrder[di]
    const colNodes = domainMap.get(did) || []
    if (colNodes.length === 0) continue
    const ci = getDomainIndex(did, domainIds)
    const colX = 30 + di * (NODE_WIDTH + COL_GAP) + NODE_WIDTH / 2

    const domainName = colNodes[0].domain_name
    flowNodes.push({
      id: `header-${did}`,
      type: 'default',
      position: { x: colX - 50, y: domainHeaderY[did] - 18 },
      data: { label: domainName },
      style: {
        background: 'transparent',
        border: 'none',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: DOMAIN_COLORS[ci].text,
        width: 100,
        textAlign: 'center' as const,
        padding: 0,
        fontFamily: 'var(--font-body), system-ui, sans-serif',
      },
      draggable: false,
      selectable: false,
    })
  }

  // 知识点节点
  for (const n of graphNodes) {
    const pos = posMap.get(n.id)
    if (!pos) continue
    const ci = getDomainIndex(n.domain_id, domainIds)
    flowNodes.push({
      id: n.id,
      type: 'custom',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - 16 },
      data: {
        label: n.name,
        domain: n.domain_name,
        difficulty: n.difficulty,
        colors: DOMAIN_COLORS[ci],
      },
    })
  }

  // 6. 构建边（smoothstep 路由 → 整洁不杂乱）
  const seenEdges = new Set<string>()
  const flowEdges: Edge[] = []
  for (const e of graphEdges) {
    const ek = `${e.source}|${e.target}|${e.relation}`
    if (seenEdges.has(ek)) continue
    seenEdges.add(ek)

    const srcPos = posMap.get(e.source)
    const tgtPos = posMap.get(e.target)
    if (!srcPos || !tgtPos) continue

    const st = RELATION_STYLES[e.relation] || RELATION_STYLES.RELATED_TO

    // 判断源和目标在同一列还是不同列
    const sameCol = e.source.startsWith('header') || e.target.startsWith('header') ||
      graphNodes.find(n => n.id === e.source)?.domain_id === graphNodes.find(n => n.id === e.target)?.domain_id

    flowEdges.push({
      id: ek,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: e.relation === 'PREREQUISITE',
      style: {
        stroke: st.color,
        strokeWidth: st.width,
        strokeDasharray: st.dash,
        opacity: st.opacity,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: st.color,
        width: 10,
        height: 10,
      },
    })
  }

  return { flowNodes, flowEdges }
}

/* ── 图例 ── */
function Legend() {
  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      left: 12,
      background: 'rgba(255,255,255,0.93)',
      borderRadius: 8,
      border: '1px solid #E5E7EB',
      padding: '8px 12px',
      fontSize: '0.6rem',
      zIndex: 10,
      boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      fontFamily: 'var(--font-body), system-ui, sans-serif',
      lineHeight: 1.4,
    }}>
      <div style={{ fontWeight: 600, color: '#1F2937', marginBottom: 3 }}>图例</div>
      {Object.entries(RELATION_STYLES).map(([key, st]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
          <svg width="20" height="3" viewBox="0 0 20 3">
            <line x1="0" y1="1.5" x2="16" y2="1.5"
              stroke={st.color} strokeWidth={st.width}
              strokeDasharray={st.dash} opacity={st.opacity} />
            {key === 'PREREQUISITE' && <polygon points="15,0 18,1.5 15,3" fill={st.color} opacity={st.opacity} />}
          </svg>
          <span style={{ color: '#6B7280', fontSize: '0.55rem' }}>{st.label}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 4, paddingTop: 3, color: '#9CA3AF', fontSize: '0.5rem' }}>
        拖拽节点可微调 · 滚轮缩放
      </div>
    </div>
  )
}

export default function KnowledgeGraphViz({ nodes, edges, onNodeClick }: Props) {
  const { flowNodes, flowEdges } = useMemo(
    () => domainColumnLayout(nodes, edges),
    [nodes, edges],
  )

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(flowNodes)
  const [rfEdges] = useEdgesState(flowEdges)

  useMemo(() => {
    setRfNodes(flowNodes)
  }, [flowNodes])

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    const graphNode = nodes.find(n => n.id === node.id)
    if (graphNode && onNodeClick) onNodeClick(graphNode)
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#F8FAFC' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodesChange={onNodesChange}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={3}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="#E2E8F0" gap={20} size={1} />
        <Controls
          style={{
            borderRadius: '6px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          }}
          showInteractive={false}
        />
        <MiniMap
          style={{
            borderRadius: '6px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          }}
          nodeColor={(n) => {
            const c = (n.data as any)?.colors
            return c?.border || '#94A3B8'
          }}
          maskColor="rgba(0,0,0,0.08)"
        />
      </ReactFlow>
      <Legend />
    </div>
  )
}
