import api from './auth'

export interface GraphNode {
  id: string
  name: string
  domain_id: string
  domain_name: string
  difficulty: number
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export const knowledgeGraphApi = {
  /** 获取指定学科的图谱可视化数据 */
  getGraphData: (subjectId: string) =>
    api.get<GraphData>('/knowledge-graph/graph', { params: { subject_id: subjectId } }),
}
