import api from './auth'

export interface PathNodeStatus {
  point_id: string
  point_name: string
  domain_name: string
  mastery_score: number
  status: 'not_started' | 'learning' | 'mastered' | 'reviewing'
  is_difficult: boolean
  needs_review: boolean
}

export interface DagNode {
  id: string
  point_id: string
  label: string
  progress: 'completed' | 'in_progress' | 'not_started'
  mastery_score: number
  is_weak: boolean
  domain: string
  subject: string
}

export interface DagEdge {
  id: string
  source: string
  target: string
  label: string
  type: 'PREREQUISITE' | 'RELATED_TO'
  animated: boolean
}

export interface DagData {
  nodes: DagNode[]
  edges: DagEdge[]
  metadata: Record<string, any>
}

export interface LearningPathMarkdownResponse {
  markdown: string
  nodes: PathNodeStatus[]
  summary: {
    total: number
    mastered: number
    learning: number
    not_started: number
    reviewing: number
    difficult: number
  }
  dag_data: DagData
}

export interface PathHistoryItem {
  id: string
  agent_reason: string | null
  snapshot_data: Record<string, any>
  created_at: string
}

export interface PathHistoryResponse {
  items: PathHistoryItem[]
  total: number
}

export interface AgentRecommendation {
  type: 'review' | 'practice' | 'study_rest' | 'study' | 'unlock' | 'breakthrough'
  title: string
  description: string
  priority: 'high' | 'normal' | 'low'
  related_point_id: string | null
  related_point_name: string | null
  action_label: string
  action_url: string
}

export interface AgentRecommendationListResponse {
  recommendations: AgentRecommendation[]
  total: number
}

export interface KnowledgePointRecordResponse {
  point_id: string
  point_name: string
  domain_name: string
  subject_name: string
  mastery_score: number
  recent_accuracy: number
  consecutive_errors: number
  total_practiced: number
  total_correct: number
  total_time_spent_seconds: number
  study_count: number
  last_study_at: string | null
  last_practice_at: string | null
  next_review_at: string | null
  status: string
}

export const pathApi = {
  /** 获取学习路径思维导图 Markdown + 节点状态 */
  getCurrentPath: () =>
    api.get<LearningPathMarkdownResponse>('/path/current'),

  /** 获取 Agent 推荐列表 */
  getAgentRecommendations: (params?: Record<string, any>) =>
    api.get<AgentRecommendationListResponse>('/path/agent/recommend', { params }),

  /** 接受 Agent 建议 */
  acceptRecommendation: (data: {
    recommendation_type: string
    point_id?: string
  }) =>
    api.post('/path/agent/accept', data),

  /** 拒绝 Agent 建议 */
  rejectRecommendation: (data: {
    recommendation_type: string
    point_id?: string
  }) =>
    api.post('/path/agent/reject', data),

  /** 获取单个知识点详情 */
  getKnowledgeDetail: (pointId: string) =>
    api.get<KnowledgePointRecordResponse>(`/path/knowledge/${pointId}`),

  /** 记录知识点了解行为（标记/取消标记已学习） */
  recordKnowledgeStudy: (pointId: string, durationSeconds?: number, action?: 'mark' | 'unmark') =>
    api.post(`/path/knowledge/${pointId}/record-study`, {
      study_duration_seconds: durationSeconds ?? 30,
      action: action ?? 'mark',
    }),

  /** 获取路径调整历史 */
  getPathHistory: () =>
    api.get<PathHistoryResponse>('/path/history'),
}
